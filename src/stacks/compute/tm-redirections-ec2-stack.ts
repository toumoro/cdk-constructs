import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { importVpc, publishParameter } from '../common/references';

/**
 * Props for `TmRedirectionsEc2Stack`.
 */
export interface TmRedirectionsEc2StackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * CIDR range of the VPC.
   */
  readonly vpcCidr: string;

  /**
   * EC2 instance type.
   *
   * @default 't3a.micro'
   */
  readonly instanceType?: string;

  /**
   * Root volume size in GiB.
   *
   * @default 20
   */
  readonly ebsVolumeSize?: number;

  /**
   * Pinned AMI ID.
   *
   * @default - the latest Amazon Linux 2023 AMI, looked up once and cached in `cdk.context.json`
   */
  readonly amiId?: string;
}

/**
 * Public EC2 instance with an Elastic IP, open on ports 80 and 443, that
 * serves domain redirections (e.g. apex to `www`). The redirections are
 * configured on the instance, outside CDK. Publishes the Elastic IP in SSM.
 */
export class TmRedirectionsEc2Stack extends cdk.Stack {
  /** Security group of the instance. */
  public readonly securityGroup: ec2.ISecurityGroup;
  /** Public IP the redirected domains point to. */
  public readonly publicIp: string;

  constructor(scope: Construct, id: string, props: TmRedirectionsEc2StackProps) {
    super(scope, id, props);

    const vpc = importVpc(this, 'Vpc', props.environmentName, props.vpcCidr, [ec2.SubnetType.PUBLIC]);

    const securityGroup = new ec2.SecurityGroup(this, 'Security Group', {
      vpc,
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from anywhere');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS traffic from anywhere');
    this.securityGroup = securityGroup;

    // A different AMI replaces the instance, so it never floats.
    const machineImage = props.amiId
      ? ec2.MachineImage.genericLinux({ [this.region]: props.amiId })
      : ec2.MachineImage.latestAmazonLinux2023({ cachedInContext: true });

    const instance = new ec2.Instance(this, 'Instance', {
      instanceType: new ec2.InstanceType(props.instanceType ?? 't3a.micro'),
      machineImage,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(props.ebsVolumeSize ?? 20, {
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          deleteOnTermination: false,
          encrypted: true,
        }),
      }],
    });
    instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    // DNS records point to this address: never replace it.
    const elasticIp = new ec2.CfnEIP(this, 'Elastic IP', {
      domain: 'vpc',
    });
    elasticIp.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // Same properties as jaro's deployed association.
    new ec2.CfnEIPAssociation(this, 'Elastic IP Association', {
      eip: elasticIp.ref,
      instanceId: instance.instanceId,
    });

    this.publicIp = elasticIp.ref;

    publishParameter(this, 'PublicIpParameter', TmParameterNames.redirectionsPublicIp(props.environmentName), elasticIp.ref);
    new cdk.CfnOutput(this, 'PublicIp', { value: elasticIp.ref });
  }
}
