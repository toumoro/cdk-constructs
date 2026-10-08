import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/**
 * Props for `TmRdsBootstrap`.
 */
export interface TmRdsBootstrapProps {
  /**
   * VPC of the cluster.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Security group of the cluster: an ingress rule on 3306 from the Lambda's
   * security group is added to it.
   */
  readonly clusterSecurityGroup: ec2.ISecurityGroup;

  /**
   * Secret of the cluster admin credentials (`cluster.secret`). The Lambda reads
   * the host, port, admin user and admin password from it.
   */
  readonly adminSecret: secretsmanager.ISecret;

  /**
   * Secrets Manager secret holding the GENERATED application password. The
   * Lambda uses it to (re)initialize the password of the MySQL application
   * user. It is the SAME secret (same ARN) that ECS reads for
   * `TM_DATABASE_PASSWORD`: single source of truth.
   */
  readonly appPasswordSecret: secretsmanager.ISecret;

  /**
   * Bootstrap assets bucket (holds the dump). The Lambda reads ONLY the dump
   * key from it.
   */
  readonly assetsBucketName: string;

  /**
   * Dump key in the bucket, e.g. `db/latest.sql`.
   */
  readonly dumpKey: string;

  /**
   * Name of the application database to create, e.g. `epq_typo3_v14`.
   */
  readonly databaseName: string;

  /**
   * Name of the application user to create.
   */
  readonly databaseUsername: string;
}

/**
 * Automatic bootstrap of the application database.
 *
 * A Lambda (MySQL client) ATTACHED TO THE VPC, in a security group allowed to
 * reach the cluster on 3306, connects as admin (cluster secret), creates the
 * application database and user, forces the user's password to the value of the
 * GENERATED secret, then imports the dump (`db/latest.sql`) — idempotently, with
 * a sentinel that prevents replaying the import. If bootstrap is enabled but the
 * dump is missing, the Lambda FAILS immediately with a clear message (an empty
 * schema would make TYPO3 fail on every request and the ALB health check would
 * never succeed). On stack deletion: no action (data retained).
 *
 * Subnet choice: the Lambda is placed in the PRIVATE subnets WITH EGRESS (NAT).
 * It needs Secrets Manager (admin + application password) and S3 (dump). The
 * repository's VPC (TmVpcBase) creates only an S3 gateway endpoint; there is NO
 * Secrets Manager interface endpoint. From the ISOLATED subnets the Lambda could
 * therefore not reach Secrets Manager. The NAT already exists (no added cost),
 * whereas Secrets Manager + STS interface endpoints would cost ~$22/month. For a
 * fully isolated bootstrap, these endpoints would have to be added to the VPC.
 */
export class TmRdsBootstrap extends Construct {
  /** Security group of the bootstrap Lambda. */
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: TmRdsBootstrapProps) {
    super(scope, id);

    // Security group of the Lambda; egress open (NAT to Secrets Manager and
    // S3). The 3306 ingress is added on the cluster side.
    this.securityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Security group of the RDS bootstrap Lambda',
    });
    props.clusterSecurityGroup.addIngressRule(
      this.securityGroup, ec2.Port.tcp(3306), 'Allow from RDS bootstrap Lambda');

    const bootstrapLogGroup = new logs.LogGroup(this, 'FunctionLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const bootstrapFunction = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      // The asset bundles the handler and pymysql (pure Python): offline
      // packaging (hash/copy at synth), without Docker or pip at deploy time.
      code: lambda.Code.fromAsset(path.join(__dirname, 'bootstrap-lambda')),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.securityGroup],
      // Lambda ceiling: 15 min and /tmp 512 MB-10 GB. The import is streamed
      // (no full load into memory); beyond a large dump, use the manual import
      // from the bastion (see README).
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      logGroup: bootstrapLogGroup,
    });

    // Least privilege: read of the two specific secrets and of the single dump
    // key only. The 3306 network connection is governed by the security groups.
    props.adminSecret.grantRead(bootstrapFunction);
    props.appPasswordSecret.grantRead(bootstrapFunction);
    bootstrapFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject'],
      resources: [`arn:${cdk.Aws.PARTITION}:s3:::${props.assetsBucketName}/${props.dumpKey}`],
    }));
    bootstrapFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [`arn:${cdk.Aws.PARTITION}:s3:::${props.assetsBucketName}`],
      conditions: { StringLike: { 's3:prefix': [props.dumpKey] } },
    }));

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: bootstrapFunction,
    });

    new cdk.CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        Region: cdk.Stack.of(this).region,
        AdminSecretArn: props.adminSecret.secretArn,
        AppPasswordSecretArn: props.appPasswordSecret.secretArn,
        BucketName: props.assetsBucketName,
        DumpKey: props.dumpKey,
        DatabaseName: props.databaseName,
        DatabaseUsername: props.databaseUsername,
      },
    });
  }
}
