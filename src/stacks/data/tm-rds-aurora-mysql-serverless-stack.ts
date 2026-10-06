import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { TmRdsAuroraMysqlDashboard } from '../../databases/rds-aurora-mysql-dashboard';
import { TmRdsAuroraMysqlServerless } from '../../databases/rds-aurora-mysql-serverless';
import { importSecurityGroup, importVpc, publishParameter } from '../common/references';

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
    const vpc = importVpc(this, 'Vpc', env, props.vpcCidr, [ec2.SubnetType.PRIVATE_ISOLATED]);
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
  }
}
