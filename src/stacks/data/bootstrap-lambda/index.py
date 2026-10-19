"""Idempotent bootstrap of the TYPO3 application database.

Triggered as a CloudFormation custom resource by the `TmRdsBootstrap`
construct, through the CDK Provider framework (which sends the CloudFormation
response: this handler only returns or raises). On stack create/update:

  1. reads the cluster admin credentials (secret `cluster.secret`);
  2. reads the generated application password (Secrets Manager secret);
  3. creates the application database and user if they do not exist, then forces
     the user's password to the current generated value and grants the
     privileges (idempotent);
  4. checks a sentinel (table `_tm_bootstrap`): if the import already happened,
     it is NOT replayed (no overwrite);
  5. otherwise, requires the dump in the bucket (IMMEDIATE and explicit FAILURE
     if it is missing), imports it statement by statement, VERIFIES that every
     table the dump creates exists, then writes the sentinel.

On deletion: NO action (the data is retained, RETAIN).

The dump is read as a stream and split by `iter_statements`, a tokenizer that
understands quoted strings (with backslash escapes and doubled quotes),
`--`/`#` line comments, `/* */` block comments, MySQL `/*! */` conditional
comments (executed, like the mysql client does) and `DELIMITER`. Statements
are sent to the server as the exact bytes of the dump, so binary data is not
altered by a text decoding. Nothing is skipped silently: the few statements the
importer refuses to run (see `skip_reason`) are logged one by one.
"""

import re
import time

SENTINEL_TABLE = "_tm_bootstrap"

# Bytes a statement cannot span across a chunk boundary without a look-ahead:
# `--` + whitespace (3), `/*` (2), the delimiter (variable).
_MIN_LOOKAHEAD = 3

# A `DELIMITER xxx` line (mysql client command), only at the start of a statement.
_DELIMITER_RE = re.compile(rb"\s*DELIMITER[ \t]+(\S+)[ \t]*(?:\r?\n|$)", re.IGNORECASE)
_NEWLINE_RE = re.compile(rb"\r?\n")
_BLOCK_COMMENT_END_RE = re.compile(rb"\*/")
# Table name: `name`, name, `db`.`name` or db.name.
_CREATE_TABLE_RE = re.compile(
    rb"CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"
    rb"((?:`[^`]+`|[^`\s(.]+)(?:\.(?:`[^`]+`|[^`\s(.]+))?)",
    re.IGNORECASE)
_FIRST_WORD_RE = re.compile(rb"[A-Za-z]+")

# Statements the importer never runs: they target the whole server, another
# schema, or binary logging, none of which a schema import may touch.
_SKIP_PATTERNS = (
    (re.compile(rb"^SET\s+@@GLOBAL\.", re.IGNORECASE), "server-wide SET @@GLOBAL"),
    (re.compile(rb"^SET\s+@@SESSION\.SQL_LOG_BIN\b", re.IGNORECASE), "SET SQL_LOG_BIN (not allowed on Aurora)"),
    (re.compile(rb"^SET\s+SQL_LOG_BIN\b", re.IGNORECASE), "SET SQL_LOG_BIN (not allowed on Aurora)"),
    (re.compile(rb"^CREATE\s+DATABASE\b", re.IGNORECASE), "CREATE DATABASE (the target database is already selected)"),
    (re.compile(rb"^CREATE\s+SCHEMA\b", re.IGNORECASE), "CREATE SCHEMA (the target database is already selected)"),
    (re.compile(rb"^USE\s", re.IGNORECASE), "USE (the target database is already selected)"),
)


def strip_leading_comments(statement):
    """Remove the whitespace and the plain comments before the first SQL token.

    MySQL conditional comments (`/*! ... */`) are SQL and are kept. Returns
    bytes; empty when the statement holds nothing but comments.
    """
    i = 0
    n = len(statement)
    while i < n:
        c = statement[i:i + 1]
        if c in b" \t\r\n":
            i += 1
        elif c == b"#" or (statement.startswith(b"--", i) and (i + 2 >= n or statement[i + 2:i + 3] in b" \t\r\n")):
            m = _NEWLINE_RE.search(statement, i)
            if not m:
                return b""
            i = m.end()
        elif statement.startswith(b"/*", i) and not statement.startswith(b"/*!", i):
            m = _BLOCK_COMMENT_END_RE.search(statement, i + 2)
            if not m:
                return b""
            i = m.end()
        else:
            break
    return statement[i:].rstrip()


def executable_sql(statement):
    """The SQL to send for a statement: conditional comments unwrapped.

    MySQL servers execute `/*!NNNNN sql */` natively, but a statement that is
    nothing but a conditional comment (`/*!40101 SET NAMES utf8mb4 */`) must be
    unwrapped to be classified (and skipped when needed). The server behaves the
    same either way, so unwrapping is always safe.
    """
    sql = strip_leading_comments(statement)
    m = re.match(rb"/\*!\d{0,5}\s*(.*)\*/\s*$", sql, re.DOTALL)
    if m:
        return m.group(1).strip()
    return sql


def skip_reason(sql):
    """Why the importer refuses to run this statement, or None."""
    for pattern, reason in _SKIP_PATTERNS:
        if pattern.search(sql):
            return reason
    return None


def statement_kind(sql):
    """`CREATE TABLE`, `INSERT`, `DROP`... for the summary."""
    m = _FIRST_WORD_RE.match(sql)
    if not m:
        return "OTHER"
    kind = m.group(0).upper()
    if kind in (b"CREATE", b"DROP", b"ALTER") and _CREATE_TABLE_RE.match(sql):
        return "CREATE TABLE"
    return kind.decode("ascii")


def created_table(sql):
    """Name of the table a `CREATE TABLE` creates, or None."""
    m = _CREATE_TABLE_RE.match(sql)
    if not m:
        return None
    name = m.group(1)
    # `db`.`table` -> table (a dot inside backticks is part of the name)
    if not name.endswith(b"`") and b"." in name:
        name = name.rsplit(b".", 1)[1]
    elif name.endswith(b"`") and b"`.`" in name:
        name = name.rsplit(b"`.`", 1)[1]
    return name.strip(b"`").decode("utf-8", "replace")


class _Stream:
    """A byte buffer fed from a stream of chunks, with regex search and look-ahead.

    `search` guarantees that a returned match is followed by at least
    `lookahead` bytes (or the end of the stream), so a token cut by a chunk
    boundary (`--`, `/*`, a multi-byte delimiter) is never misread.
    """

    def __init__(self, chunks, lookahead):
        self._chunks = iter(chunks)
        self.buf = b""
        self.eof = False
        self.lookahead = lookahead

    def pull(self):
        chunk = next(self._chunks, b"")
        if chunk:
            self.buf += chunk
        else:
            self.eof = True
        return bool(chunk)

    def ensure(self, pos, n):
        """Make `pos + n` bytes available, unless the stream ends first."""
        while len(self.buf) < pos + n and not self.eof:
            self.pull()

    def search(self, regex, pos):
        """First match of `regex` at or after `pos`, with look-ahead; None at EOF."""
        while True:
            m = regex.search(self.buf, pos)
            if m and (self.eof or m.end() + self.lookahead <= len(self.buf)):
                return m
            if self.eof:
                return m
            if not m:
                # Nothing before the end: resume just before it, so a token cut
                # by the boundary is seen whole once more data arrives.
                pos = max(pos, len(self.buf) - self.lookahead)
            self.pull()

    def discard(self, upto):
        """Drop the consumed prefix; positions must then be shifted by `upto`."""
        self.buf = self.buf[upto:]


def iter_statements(chunks):
    """Yield the statements of a SQL dump read as a stream of byte chunks.

    Each statement is returned as the exact bytes of the dump, delimiter
    excluded, with the leading comments removed. Statements made only of
    comments are dropped. Quoted strings ('...', "...", `...`) are honoured
    with backslash escapes and doubled quotes, as are `--` and `#` line
    comments, `/* */` block comments, `/*! */` conditional comments (kept as
    SQL) and `DELIMITER` client commands.
    """
    delimiter = b";"
    stream = _Stream(chunks, lookahead=_MIN_LOOKAHEAD + len(delimiter))
    normal_re = _normal_re(delimiter)
    start = 0  # start of the statement being built
    pos = 0  # scan position

    while True:
        # `DELIMITER xxx` (mysql client command) at the start of a statement.
        stream.ensure(start, 64)
        m = _DELIMITER_RE.match(stream.buf, start)
        if m:
            delimiter = m.group(1)
            stream.lookahead = _MIN_LOOKAHEAD + len(delimiter)
            normal_re = _normal_re(delimiter)
            start = pos = m.end()
            continue

        m = stream.search(normal_re, pos)
        if not m:
            break
        token = m.group(0)
        if token == delimiter:
            statement = strip_leading_comments(stream.buf[start:m.start()])
            if statement:
                yield statement
            stream.discard(m.end())
            start = pos = 0
        elif token in (b"'", b'"', b"`"):
            pos = _skip_quoted(stream, m.end(), token)
        elif token == b"#":
            pos = _skip_line(stream, m.end())
        elif token == b"--":
            nxt = stream.buf[m.end():m.end() + 1]
            pos = _skip_line(stream, m.end()) if (nxt == b"" or nxt in b" \t\r\n") else m.end()
        else:  # b"/*"
            if stream.buf[m.end():m.end() + 1] == b"!":
                pos = m.end()  # conditional comment: SQL, keep scanning
            else:
                pos = _skip_block_comment(stream, m.end())

    tail = strip_leading_comments(stream.buf[start:])
    if tail:
        yield tail


def _skip_quoted(stream, pos, quote):
    """Position right after the closing quote of a string opened before `pos`."""
    regex = re.compile(rb"[\\" + re.escape(quote) + rb"]")
    while True:
        m = stream.search(regex, pos)
        if not m:
            return len(stream.buf)  # unterminated string: consume to the end
        if m.group(0) == b"\\":
            pos = m.end() + 1  # the escaped byte is part of the string
        elif stream.buf[m.end():m.end() + 1] == quote:
            pos = m.end() + 1  # doubled quote inside the string
        else:
            return m.end()


def _skip_line(stream, pos):
    m = stream.search(_NEWLINE_RE, pos)
    return m.end() if m else len(stream.buf)


def _skip_block_comment(stream, pos):
    m = stream.search(_BLOCK_COMMENT_END_RE, pos)
    return m.end() if m else len(stream.buf)


def _normal_re(delimiter):
    """Tokens that matter outside strings and comments, plus the delimiter."""
    return re.compile(rb"['\"`#]|--|/\*|" + re.escape(delimiter))


def _chunks(body, size=1024 * 1024):
    while True:
        chunk = body.read(size)
        if not chunk:
            return
        yield chunk


def import_dump(connection, database, body, log=print):
    """Import a SQL dump streamed from `body` into `database`.

    Returns a summary dict: statements executed per kind, statements skipped,
    and the tables the dump creates (to verify after the import).
    """
    counts = {}
    skipped = []
    tables = []
    started = time.monotonic()
    with connection.cursor() as cursor:
        cursor.execute(f"USE `{database}`")
        cursor.execute("SET SESSION FOREIGN_KEY_CHECKS = 0")
        cursor.execute("SET SESSION UNIQUE_CHECKS = 0")
        cursor.execute("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO'")
        executed = 0
        for statement in iter_statements(_chunks(body)):
            sql = executable_sql(statement)
            if not sql:
                continue
            reason = skip_reason(sql)
            if reason:
                skipped.append((sql[:120].decode("utf-8", "replace"), reason))
                log(f"SKIPPED ({reason}): {sql[:200]!r}")
                continue
            kind = statement_kind(sql)
            table = created_table(sql)
            if table:
                tables.append(table)
            cursor.execute(sql)
            counts[kind] = counts.get(kind, 0) + 1
            executed += 1
            if executed % 500 == 0:
                log(f"... {executed} statements executed ({time.monotonic() - started:.0f}s)")
        cursor.execute("SET SESSION UNIQUE_CHECKS = 1")
        cursor.execute("SET SESSION FOREIGN_KEY_CHECKS = 1")
    return {"counts": counts, "skipped": skipped, "tables": tables, "seconds": round(time.monotonic() - started, 1)}


def missing_tables(connection, database, expected):
    """Tables of `expected` absent from `database` after the import."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = %s",
            (database,),
        )
        present = {row[0] for row in cursor.fetchall()}
    return sorted(set(expected) - present)


def _secret_json(secrets_client, arn):
    """Return the content of a secret, decoded as JSON when possible."""
    import json

    value = secrets_client.get_secret_value(SecretId=arn)["SecretString"]
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return value


def _bootstrap(event):
    import boto3
    import pymysql

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
        charset="utf8mb4", autocommit=True, connect_timeout=10,
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
            head = s3.head_object(Bucket=bucket, Key=dump_key)
        except Exception as error:  # noqa: BLE001
            raise RuntimeError(
                f"Bootstrap enabled but the dump '{dump_key}' is not found in "
                f"the bucket '{bucket}'. Upload it before the deployment "
                f"(detail: {error})."
            )
        print(f"Importing s3://{bucket}/{dump_key} ({head.get('ContentLength', '?')} bytes, "
              f"last modified {head.get('LastModified', '?')}) into `{database}`")

        body = s3.get_object(Bucket=bucket, Key=dump_key)["Body"]
        summary = import_dump(connection, database, body)
        counts = ", ".join(f"{kind}: {count}" for kind, count in sorted(summary["counts"].items()))
        print(f"Executed {sum(summary['counts'].values())} statements in {summary['seconds']}s ({counts}); "
              f"{len(summary['skipped'])} skipped; {len(summary['tables'])} tables created by the dump")

        # The import is only a success if every table the dump creates exists.
        missing = missing_tables(connection, database, summary["tables"])
        if missing:
            raise RuntimeError(
                f"Import incomplete: {len(missing)} of the {len(summary['tables'])} tables created by the dump "
                f"are missing after the import: {', '.join(missing)}."
            )

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
        return (
            f"Dump '{dump_key}' imported into '{database}': {len(summary['tables'])} tables, "
            f"{summary['counts'].get('INSERT', 0)} INSERT statements, {len(summary['skipped'])} statements skipped; "
            "sentinel written."
        )
    finally:
        connection.close()


def handler(event, context):
    """Entry point of the custom resource, called by the CDK Provider framework.

    Returns the custom resource attributes; raises to report a failure (the
    framework sends the CloudFormation response either way).
    """
    request_type = event.get("RequestType", "Create")
    physical_id = event.get("PhysicalResourceId") or "tm-rds-bootstrap"
    print(f"RequestType={request_type}")

    if request_type == "Delete":
        # RETAIN: nothing is deleted.
        return {"PhysicalResourceId": physical_id, "Data": {"Result": "Deletion with no effect (data retained)."}}

    message = _bootstrap(event)
    print(message)
    return {"PhysicalResourceId": physical_id, "Data": {"Result": message}}
