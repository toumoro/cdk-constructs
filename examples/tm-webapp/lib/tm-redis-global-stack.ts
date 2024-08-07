import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { aws_elasticache as elasticache } from 'aws-cdk-lib';
import { TmElasticacheRedisCluster } from '../../../src/databases/elasticache-redis-cluster';

interface TmRedisGlobalStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  allowFromConstructs?: { [key: string]: ec2.IConnectable  };
}

export class TmRedisGlobalStack extends cdk.Stack {
  public readonly globalReplicationGroupId: string
  constructor(scope: Construct, id: string, props?: TmRedisGlobalStackProps) {
    super(scope, id, props);

    const primaryRedisCluster = new TmElasticacheRedisCluster(this, 'TmRedisCluster', {
      envName: 'dev',
      vpc: props!.vpc,
      cacheNodeType: 'cache.r5.large',
      allowFromConstructs: props?.allowFromConstructs,
    });

    const globalReplicationGroup = new elasticache.CfnGlobalReplicationGroup(this, "GlobalReplicationGroup", {
      globalReplicationGroupIdSuffix: 'dev',
      members: [
        {
          replicationGroupId: primaryRedisCluster.cluster.ref,
          replicationGroupRegion: this.region,
          role: 'PRIMARY'
        },
      ],
      automaticFailoverEnabled: true,
      engineVersion: "7.1",
      globalReplicationGroupDescription: 'dev-GlobalDatastore',
    });

    this.globalReplicationGroupId = globalReplicationGroup.ref;
  }
}
