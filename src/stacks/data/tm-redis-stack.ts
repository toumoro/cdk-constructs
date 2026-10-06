import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { TmElasticacheRedisCluster } from '../../databases/elasticache-redis-cluster';
import { importSecurityGroup, importVpc, publishParameter } from '../common/references';

/**
 * Props for `TmRedisStack`.
 */
export interface TmRedisStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * CIDR range of the VPC.
   */
  readonly vpcCidr: string;

  /**
   * Cache node type.
   *
   * @default 'cache.t3.micro'
   */
  readonly cacheNodeType?: string;

  /**
   * Number of replicas. With at least one, automatic failover and Multi-AZ are on.
   *
   * @default 0
   */
  readonly replicasPerNodeGroup?: number;
}

/**
 * Redis replication group (cluster mode disabled), reachable from the bastion.
 * Publishes its primary endpoint and security group ID in SSM.
 */
export class TmRedisStack extends cdk.Stack {
  /** Security group of the replication group. */
  public readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: TmRedisStackProps) {
    super(scope, id, props);

    const env = props.environmentName;
    const vpc = importVpc(this, 'Vpc', env, props.vpcCidr, [ec2.SubnetType.PRIVATE_WITH_EGRESS]);
    const bastionSecurityGroup = importSecurityGroup(this, 'BastionSecurityGroup', TmParameterNames.bastionSecurityGroupId(env));
    const replicas = props.replicasPerNodeGroup ?? 0;

    const redisCluster = new TmElasticacheRedisCluster(this, 'TmRedisCluster', {
      envName: 'tm',
      vpc,
      clusterMode: 'Disabled',
      cacheNodeType: props.cacheNodeType ?? 'cache.t3.micro',
      replicasPerNodeGroup: replicas,
      automaticFailoverEnabled: replicas > 0,
      multiAzEnabled: replicas > 0,
      allowFromConstructs: { bastion: bastionSecurityGroup },
    });
    redisCluster.cluster.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // Cluster mode disabled: the primary endpoint is the write endpoint.
    publishParameter(this, 'RedisPrimaryEndpoint', TmParameterNames.redisPrimaryEndpoint(env), redisCluster.cluster.attrPrimaryEndPointAddress);

    this.securityGroup = redisCluster.securityGroup;

    publishParameter(this, 'SecurityGroupIdParameter', TmParameterNames.redisSecurityGroupId(env), this.securityGroup.securityGroupId);
  }
}
