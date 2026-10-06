import { aws_elasticache as elasticache, Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface IRedisClusterProps {
  envName: string;
  vpc: ec2.IVpc;
  cacheNodeType?: string;
  engine?: string;
  engineVersion?: string;
  replicasPerNodeGroup?: number;
  autoMinorVersionUpgrade?: boolean;
  automaticFailoverEnabled?: boolean;
  multiAzEnabled?: boolean;
  allowFromConstructs?: { [key: string]: ec2.IConnectable };
  clusterMode?: string;
  globalReplicationGroupId?: string;
  allowFrom?: ec2.ISecurityGroup;
  parameterGroupProperties?: { [key: string]: string };
}

export class TmElasticacheRedisCluster extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly subnetGroup: elasticache.CfnSubnetGroup;
  public readonly cluster: elasticache.CfnReplicationGroup;
  public readonly parameterGroup?: elasticache.CfnParameterGroup;

  constructor(scope: Construct, id: string, props: IRedisClusterProps) {
    super(scope, id);

    const {
      envName,
      vpc,
      cacheNodeType = 'cache.t3.micro',
      engine = 'redis',
      engineVersion = '7.1',
      replicasPerNodeGroup = 1,
      autoMinorVersionUpgrade = true,
      automaticFailoverEnabled = true,
      multiAzEnabled = true,
      clusterMode = 'Enabled',
      globalReplicationGroupId,
      allowFromConstructs,
      parameterGroupProperties,
    } = props;

    this.securityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: vpc,
    });
    Tags.of(this.securityGroup).add('Name', 'redis-cluster');

    for (const construct in allowFromConstructs) {
      this.securityGroup.connections.allowFrom(
        allowFromConstructs[construct],
        ec2.Port.tcp(6379),
        construct,
      );
    }

    this.subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
      description: `${envName}-redis`,
      cacheSubnetGroupName: `${envName}-redis`,
    });

    const replicationGroupProps: any = {
      replicationGroupDescription: `${envName}-Redis`,
      cacheSubnetGroupName: this.subnetGroup.cacheSubnetGroupName,
      securityGroupIds: [this.securityGroup.securityGroupId],
      replicasPerNodeGroup: replicasPerNodeGroup,
      engine: engine,
      engineVersion: engineVersion,
    };

    if (globalReplicationGroupId) {
      replicationGroupProps.globalReplicationGroupId = globalReplicationGroupId;
    } else {
      replicationGroupProps.multiAzEnabled = multiAzEnabled;
      replicationGroupProps.autoMinorVersionUpgrade = autoMinorVersionUpgrade;
      replicationGroupProps.automaticFailoverEnabled = automaticFailoverEnabled;
      replicationGroupProps.clusterMode = clusterMode;
      replicationGroupProps.cacheNodeType = cacheNodeType;
    }

    // Create a custom parameter group for Valkey, deriving the family from the
    // engine major version (valkey8, valkey9, ...). Any custom parameters
    // (e.g. maxmemory-policy) are passed through parameterGroupProperties.
    if (engine === 'valkey') {
      const majorVersion = engineVersion.split('.')[0];
      this.parameterGroup = new elasticache.CfnParameterGroup(this, 'ValkeyParameterGroup', {
        cacheParameterGroupFamily: `valkey${majorVersion}`,
        description: `Valkey ${engineVersion} Parameter Group for ${envName}`,
        properties: parameterGroupProperties ?? {},
      });
      replicationGroupProps.cacheParameterGroupName = this.parameterGroup.ref;
    }

    //console.log(replicationGroupProps);
    this.cluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', replicationGroupProps);
    this.cluster.addDependency(this.subnetGroup);
  }
}