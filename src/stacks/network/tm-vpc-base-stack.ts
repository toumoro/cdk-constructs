import * as cdk from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { TmVpcBase } from '../../network/vpc-base';
import { publishParameter, VPC_MAX_AZS } from '../common/references';

/**
 * Props for `TmVpcBaseStack`.
 */
export interface TmVpcBaseStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * CIDR range of the VPC.
   */
  readonly cidr: string;

  /**
   * Name of the private hosted zone.
   */
  readonly hostedZoneName: string;
}

/**
 * VPC (public, private and isolated subnets over two AZs) and a private
 * hosted zone. Publishes the VPC and subnet IDs in SSM.
 */
export class TmVpcBaseStack extends cdk.Stack {
  /** The VPC. */
  public readonly vpc: IVpc;
  /** The private hosted zone. */
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: TmVpcBaseStackProps) {
    super(scope, id, props);

    this.vpc = new TmVpcBase(this, 'Vpc-CDK', {
      rangeCidr: props.cidr,
      enableEndpoints: ['s3'],
      maxAzs: VPC_MAX_AZS,
    });

    this.hostedZone = new route53.PrivateHostedZone(this, 'PrivateHostedZone', {
      zoneName: props.hostedZoneName,
      vpc: this.vpc,
    });

    const env = props.environmentName;
    const joinIds = (subnets: { subnetId: string }[]) => cdk.Fn.join(',', subnets.map(s => s.subnetId));

    publishParameter(this, 'VpcIdParameter', TmParameterNames.vpcId(env), this.vpc.vpcId);
    publishParameter(this, 'PublicSubnetIdsParameter', TmParameterNames.vpcPublicSubnetIds(env), joinIds(this.vpc.publicSubnets));
    publishParameter(this, 'PrivateSubnetIdsParameter', TmParameterNames.vpcPrivateSubnetIds(env), joinIds(this.vpc.privateSubnets));
    publishParameter(this, 'IsolatedSubnetIdsParameter', TmParameterNames.vpcIsolatedSubnetIds(env), joinIds(this.vpc.isolatedSubnets));
    publishParameter(this, 'HostedZoneIdParameter', TmParameterNames.vpcHostedZoneId(env), this.hostedZone.hostedZoneId);
  }
}
