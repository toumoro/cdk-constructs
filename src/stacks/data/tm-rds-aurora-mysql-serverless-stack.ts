import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { TmRdsBootstrap } from './tm-rds-bootstrap';
import { TmParameterNames } from '../../config/parameter-names';
import { TmRdsAuroraMysqlDashboard } from '../../databases/rds-aurora-mysql-dashboard';
import { TmRdsAuroraMysqlServerless } from '../../databases/rds-aurora-mysql-serverless';
import { importSecurityGroup, importVpc, publishParameter, readParameter } from '../common/references';

/**
 * Automatic bootstrap of the application database.
 */
export interface TmRdsBootstrapSettings {
  /**
   * Enables bootstrap: creates the Lambda that creates the database/user, sets
   * the generated password and imports the dump. DISABLED by default, so
   * nothing is created for other consumers.
   */
  readonly enabled: boolean;

  /**
   * Dump key in the bootstrap assets bucket.
   *
   * @default 'db/latest.sql'
   */
  readonly dumpKey?: string;

  /**
   * Name of the application database (`TM_DATABASE_NAME`).
   */
  readonly databaseName: string;

  /**
   * Name of the application user (`TM_DATABASE_USERNAME`).
   */
  readonly databaseUsername: string;

  /**
   * Application name (segment of the secrets path `/applications/<name>/`), used
   * to publish/read the ARN of the generated password.
   */
  readonly applicationName: string;
}

/**
 * Props for `TmRdsAuroraMysqlServerlessStack`.
 */
export interface TmRdsAuroraMysqlServerlessStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * CIDR range of the VPC.
   */
  readonly vpcCidr: string;

  /**
   * Instance type of a provisioned writer, e.g. `t3.medium`.
   *
   * @default - an Aurora Serverless v2 writer
   */
  readonly instanceType?: string;

  /**
   * Enables Performance Insights (unsupported on t3 instance classes).
   *
   * @default true
   */
  readonly performanceInsights?: boolean;

  /**
   * Database bootstrap. Opt-in: without it (default), no bootstrap Lambda,
   * secret or SSM read is created, so other consumers are untouched.
   *
   * @default - no bootstrap
   */
  readonly bootstrap?: TmRdsBootstrapSettings;
}

/**
 * Aurora MySQL cluster, reachable from the bastion, with capacity alarms and a
 * slow-query dashboard. Publishes its endpoints, ARN and security group ID in
 * SSM.
 */
export class TmRdsAuroraMysqlServerlessStack extends cdk.Stack {
  /** Security group of the cluster. */
  public readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: TmRdsAuroraMysqlServerlessStackProps) {
    super(scope, id, props);

    const env = props.environmentName;
    const subnetTypes = props.bootstrap?.enabled
      ? [ec2.SubnetType.PRIVATE_ISOLATED, ec2.SubnetType.PRIVATE_WITH_EGRESS]
      : [ec2.SubnetType.PRIVATE_ISOLATED];
    const vpc = importVpc(this, 'Vpc', env, props.vpcCidr, subnetTypes);
    const bastionSecurityGroup = importSecurityGroup(this, 'BastionSecurityGroup', TmParameterNames.bastionSecurityGroupId(env));

    const cluster = new TmRdsAuroraMysqlServerless(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_10_2,
      }),
      vpc,
      provisionedInstanceType: props.instanceType ? new ec2.InstanceType(props.instanceType) : undefined,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    // The admin credentials must outlive the stack, like the cluster.
    cluster.secret?.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // The construct always enables Performance Insights on the writer.
    if (props.performanceInsights === false) {
      cluster.node.findAll().forEach((child) => {
        if (child instanceof rds.CfnDBInstance) {
          child.enablePerformanceInsights = false;
          child.performanceInsightsRetentionPeriod = undefined;
          child.performanceInsightsKmsKeyId = undefined;
        }
      });
    }

    cluster.connections.allowFrom(bastionSecurityGroup, ec2.Port.tcp(3306));

    cluster.metricServerlessDatabaseCapacity({
      period: cdk.Duration.minutes(10),
    }).createAlarm(this, 'capacity', {
      threshold: 1.5,
      evaluationPeriods: 3,
    });
    cluster.metricACUUtilization({
      period: cdk.Duration.minutes(10),
    }).createAlarm(this, 'alarm', {
      evaluationPeriods: 3,
      threshold: 90,
    });

    publishParameter(this, 'clusterRdsArn', TmParameterNames.rdsClusterArn(env), cluster.clusterArn);
    publishParameter(this, 'clusterRdsWrite', TmParameterNames.rdsWriterEndpoint(env), cluster.clusterEndpoint.hostname);
    publishParameter(this, 'clusterRdsRead', TmParameterNames.rdsReaderEndpoint(env), cluster.clusterReadEndpoint.hostname);

    new TmRdsAuroraMysqlDashboard(this, 'Dashboard', {
      clusterIdentifier: cluster.clusterIdentifier,
      dashboardName: 'MysqlDashboard',
    });

    this.securityGroup = cluster.connections.securityGroups[0];

    publishParameter(this, 'SecurityGroupIdParameter', TmParameterNames.rdsSecurityGroupId(env), this.securityGroup.securityGroupId);

    // Opt-in bootstrap. Nothing is created by default (other consumers
    // unchanged). The application password is a secret GENERATED by CDK here
    // (single source of truth), whose ARN is published under
    // /applications/<app>/generated/TM_DATABASE_PASSWORD-arn: the bootstrap
    // Lambda reads it directly, and ECS reads it through this same ARN parameter
    // (secretsFromSecretsManager with no field). ECS depends on this stack, so
    // the parameter exists when ECS deploys.
    if (props.bootstrap?.enabled) {
      const bootstrap = props.bootstrap;
      const passwordName = 'TM_DATABASE_PASSWORD';

      // Same generation mechanism as the ECS generatedSecrets path: random
      // string without punctuation (safe in an environment variable).
      const appPasswordSecret = new secretsmanager.Secret(this, 'AppDatabasePassword', {
        secretName: `/applications/${bootstrap.applicationName}/generated/${passwordName}`,
        generateSecretString: {
          passwordLength: 64,
          excludePunctuation: true,
          includeSpace: false,
        },
      });
      // The password must outlive the stack, like the cluster.
      appPasswordSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
      publishParameter(this, 'AppDatabasePasswordArnParameter',
        TmParameterNames.generatedSecretArn(bootstrap.applicationName, passwordName),
        appPasswordSecret.secretArn);

      // The cluster admin is required to create the database/user.
      if (!cluster.secret) {
        throw new Error('The RDS cluster must have an admin secret to bootstrap the database.');
      }

      // Name of the bootstrap assets bucket, published by TmBootstrapAssetsStack.
      const assetsBucketName = readParameter(this, TmParameterNames.bootstrapAssetsBucketName(env));

      new TmRdsBootstrap(this, 'Bootstrap', {
        vpc,
        clusterSecurityGroup: this.securityGroup,
        adminSecret: cluster.secret,
        appPasswordSecret,
        assetsBucketName,
        dumpKey: bootstrap.dumpKey ?? 'db/latest.sql',
        databaseName: bootstrap.databaseName,
        databaseUsername: bootstrap.databaseUsername,
      });
    }
  }
}
