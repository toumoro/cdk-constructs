import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';


export interface TmRdsAuroraMysqlServerlessProps extends rds.DatabaseClusterProps{
  /**
   * Enable the creation of a Global Cluster for the RDS cluster.
   */
  readonly enableGlobal?: boolean ;

  /**
   * The instance type for a provisioned writer.
   * If provided, a provisioned writer will be created instead of a serverless one.
   * @default - An Aurora Serverless v2 writer is created.
   */
  readonly provisionedInstanceType?: ec2.InstanceType;
}

export class TmRdsAuroraMysqlServerless extends rds.DatabaseCluster {
  /**
     * The Aurora Mysql Serverless created by the construct rdsAuroraMysqlServerless.
  */

  /**
   * Represents a class that creates an RDS Aurora MySQL Serverless database cluster.
   */
  constructor(
    scope: Construct,
    id: string,
    props?: TmRdsAuroraMysqlServerlessProps,
  ) {

    const performanceInsightRetention = rds.PerformanceInsightRetention.DEFAULT;
    // Conditionally create the writer instance props
    const writerProps = props?.provisionedInstanceType
      ? rds.ClusterInstance.provisioned('writer', {
        instanceType: props.provisionedInstanceType,
        performanceInsightRetention: performanceInsightRetention,
      })
      : rds.ClusterInstance.serverlessV2('writer', {
        performanceInsightRetention: performanceInsightRetention,
      });

    /**
     * The default properties for the RDS Aurora MySQL Serverless database cluster.
     */
    const defaultProps: rds.DatabaseClusterProps = {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_05_2,
      }),
      writer: writerProps,
      credentials: rds.Credentials.fromUsername('admin'), // The master credentials for the database
      // to true in production
      deletionProtection: false,
      storageEncrypted: true,
      monitoringInterval: cdk.Duration.seconds(60),
      vpc: props?.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    };

    /**
     * The merged properties for the RDS Aurora MySQL Serverless database cluster.
     */
    const mergedProps = { ...defaultProps, ...props };

    /**
     * The RDS Aurora MySQL Serverless database cluster created by the construct.
     */
    super(scope, id, mergedProps);

    if (props?.enableGlobal) {
      new rds.CfnGlobalCluster(this, 'TmGlobalCluster', {
        deletionProtection: false,
        globalClusterIdentifier: 'TmGlobalCluster',
        sourceDbClusterIdentifier: this.clusterArn,
      });
    }

    new cdk.CfnOutput(this, 'ClusterWriteEndpoint', {
      value: this.clusterEndpoint.hostname,
      description: 'Cluster Write Endpoint',
    });

    new cdk.CfnOutput(this, 'ClusterReadEndpoint', {
      value: this.clusterReadEndpoint.hostname,
      description: 'Cluster Read Endpoint',
    });

    new cdk.CfnOutput(this, 'ClusterArnIdentifier', {
      value: this.clusterArn,
      description: 'Cluster ARM Identifier',
    });

    /*
    NagSuppressions.addResourceSuppressions(this, [
      //{ id: 'AwsSolutions-SMG4', reason: ' The secret does not have automatic rotation scheduled.' },
      { id: 'AwsSolutions-SMG4', reason: 'The secret does not have automatic rotation scheduled.' },
      { id: 'AwsSolutions-RDS6', reason: 'IAM Database Authentication enabled' },
      { id: 'AwsSolutions-RDS10', reason: 'The RDS DB instance does not have deletion protection enabled' },
      { id: 'AwsSolutions-RDS11', reason: 'Using a default endpoint port 3306' },
      { id: 'AwsSolutions-RDS14', reason: 'Aurora Serverless Clusters do not support Backtracking ' },
      //{ id: 'AwsSolutions-IAM4', reason: 'Replace AWS managed policies with system specific (customer) managed policies - Policy AmazonRDSEnhancedMonitoringRole' },
    ]);
    */

  }
}