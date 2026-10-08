"""Idempotent bootstrap of the TYPO3 application database.

Triggered as a CloudFormation custom resource by the `TmRdsBootstrap`
construct. On stack create/update:

  1. reads the cluster admin credentials (secret `cluster.secret`);
  2. reads the generated application password (Secrets Manager secret);
  3. creates the application database and user if they do not exist, then forces
     the user's password to the current generated value and grants the
     privileges (idempotent);
  4. checks a sentinel (table `_tm_bootstrap`): if the import already happened,
     it is NOT replayed (no overwrite);
  5. otherwise, requires the dump in the bucket (IMMEDIATE and explicit FAILURE
     if it is missing), imports it, then writes the sentinel.

On deletion: NO action (the data is retained, RETAIN).
"""

import json
import os
import urllib.request

import boto3
import pymysql

# Name of the sentinel table: its presence proves that the dump was imported.
SENTINEL_TABLE = "_tm_bootstrap"


def _send_response(event, context, status, reason, physical_id, data=None):
    """Respond to CloudFormation (custom resource)."""
    response_url = event.get("ResponseURL")
    if not response_url:
        # Call outside the CloudFormation cycle (manual test): nothing to return.
        print(f"No ResponseURL; status={status} reason={reason}")
        return
    body = json.dumps(
        {
            "Status": status,
            "Reason": reason,
            "PhysicalResourceId": physical_id or event.get("LogicalResourceId"),
            "StackId": event["StackId"],
            "RequestId": event["RequestId"],
            "LogicalResourceId": event["LogicalResourceId"],
            "NoEcho": False,
            "Data": data or {},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        response_url, data=body, method="PUT",
        headers={"content-type": "", "content-length": str(len(body))},
    )
    urllib.request.urlopen(request)  # noqa: S310 (URL provided by CloudFormation)


def _secret_json(secrets_client, arn):
    """Return the content of a secret, decoded as JSON when possible."""
    value = secrets_client.get_secret_value(SecretId=arn)["SecretString"]
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return value


def _bootstrap(event):
    props = event["ResourceProperties"]
    region = props["Region"]
    admin_secret_arn = props["AdminSecretArn"]
    app_password_secret_arn = props["AppPasswordSecretArn"]
    bucket = props["BucketName"]
    dump_key = props["DumpKey"]
    database = props["DatabaseName"]
    username = props["DatabaseUsername"]

    secrets = boto3.client("secretsmanager", region_name=region)
    s3 = boto3.client("s3", region_name=region)

    admin = _secret_json(secrets, admin_secret_arn)
    host = admin["host"]
    port = int(admin.get("port", 3306))
    admin_user = admin["username"]
    admin_password = admin["password"]

    # The generated application password: raw-string secret (no JSON field).
    app_password = _secret_json(secrets, app_password_secret_arn)
    if isinstance(app_password, dict):
        # Robustness: if the secret ever becomes a JSON object, take the field.
        app_password = app_password.get("password") or next(iter(app_password.values()))

    connection = pymysql.connect(
        host=host, port=port, user=admin_user, password=admin_password,
        autocommit=True, connect_timeout=10,
    )
    try:
        with connection.cursor() as cursor:
            # Idempotent creation of the database and the user, then syncing
            # the password to the current generated value.
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            cursor.execute(
                "CREATE USER IF NOT EXISTS %s@'%%' IDENTIFIED BY %s",
                (username, app_password),
            )
            cursor.execute(
                "ALTER USER %s@'%%' IDENTIFIED BY %s",
                (username, app_password),
            )
            cursor.execute(f"GRANT ALL PRIVILEGES ON `{database}`.* TO %s@'%%'", (username,))
            cursor.execute("FLUSH PRIVILEGES")

            # Sentinel: if it exists, the import already happened — it is not
            # replayed (no overwrite of the data).
            cursor.execute(f"USE `{database}`")
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s",
                (database, SENTINEL_TABLE),
            )
            already_imported = cursor.fetchone()[0] > 0

        if already_imported:
            return "Database already bootstrapped (sentinel present): import skipped."

        # Dump REQUIRED when bootstrap is enabled: immediate and explicit failure
        # if it is missing (otherwise TYPO3 fails on every request and the ALB
        # health check never succeeds — a 10 min timeout instead of a clear
        # error).
        try:
            s3.head_object(Bucket=bucket, Key=dump_key)
        except Exception as error:  # noqa: BLE001
            raise RuntimeError(
                f"Bootstrap enabled but the dump '{dump_key}' is not found in "
                f"the bucket '{bucket}'. Upload it before the deployment "
                f"(detail: {error})."
            )

        # Streamed import from S3: the body is read in chunks and the statements
        # are executed as they come, without loading the whole file into memory.
        body = s3.get_object(Bucket=bucket, Key=dump_key)["Body"]
        _import_dump(connection, database, body)

        with connection.cursor() as cursor:
            cursor.execute(f"USE `{database}`")
            cursor.execute(
                f"CREATE TABLE IF NOT EXISTS `{SENTINEL_TABLE}` "
                "(id INT PRIMARY KEY, imported_at DATETIME NOT NULL)"
            )
            cursor.execute(
                f"INSERT INTO `{SENTINEL_TABLE}` (id, imported_at) VALUES (1, NOW()) "
                "ON DUPLICATE KEY UPDATE imported_at = NOW()"
            )
        return f"Dump '{dump_key}' imported into '{database}' and sentinel written."
    finally:
        connection.close()


def _import_dump(connection, database, body):
    """Import a SQL dump as a stream, statement by statement.

    The S3 body is read in chunks; statements ending with ";" at the end of a
    line are executed as they go. Suitable for classic mysqldump dumps (one
    statement per logical line). For a very large dump, prefer the manual import
    from the bastion (see README).
    """
    with connection.cursor() as cursor:
        cursor.execute(f"USE `{database}`")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")

        buffer = ""
        remainder = b""
        for chunk in iter(lambda: body.read(1024 * 1024), b""):
            data = remainder + chunk
            # Split on complete line breaks; the remainder is carried over.
            *lines, remainder = data.split(b"\n")
            for raw in lines:
                line = raw.decode("utf-8", "replace")
                stripped = line.strip()
                if not stripped or stripped.startswith("--") or stripped.startswith("/*"):
                    continue
                buffer += line + "\n"
                if stripped.endswith(";"):
                    cursor.execute(buffer)
                    buffer = ""
        # Possible last statement without a trailing newline.
        tail = (buffer + remainder.decode("utf-8", "replace")).strip()
        if tail:
            cursor.execute(tail)

        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")


def handler(event, context):
    """Entry point of the CloudFormation custom resource."""
    request_type = event.get("RequestType", "Create")
    physical_id = event.get("PhysicalResourceId") or "tm-rds-bootstrap"
    print(f"RequestType={request_type}")

    try:
        if request_type == "Delete":
            # RETAIN: nothing is deleted.
            _send_response(event, context, "SUCCESS",
                           "Deletion with no effect (data retained).", physical_id)
            return

        message = _bootstrap(event)
        print(message)
        _send_response(event, context, "SUCCESS", message, physical_id)
    except Exception as error:  # noqa: BLE001
        reason = str(error)
        print(f"FAILURE: {reason}")
        _send_response(event, context, "FAILED", reason, physical_id)
        raise
