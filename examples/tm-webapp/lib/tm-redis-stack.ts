import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { TmElasticacheRedisCluster } from '../../../src/databases/elasticache-redis-cluster';

interface TmRedisStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  globalReplicationGroupId: string;
  allowFromConstructs?: { [key: string]: ec2.IConnectable  }; 
}

export class TmRedisStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: TmRedisStackProps) {
    super(scope, id, props);

    new TmElasticacheRedisCluster(this, 'TmRedisCluster', {
      envName: 'dev',
      vpc: props!.vpc,
      globalReplicationGroupId: props!.globalReplicationGroupId,
      allowFromConstructs: props!.allowFromConstructs,
    });

  }
}
