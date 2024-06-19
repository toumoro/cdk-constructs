import { CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Represents the configuration for a VPC.
 */

export interface TmVpcProps extends ec2.VpcProps {
  /**
   * The CIDR block for the VPC.
   */
  readonly rangeCidr: string;

  /**
   * The maximum number of availability zones to use for the VPC.
   */
  //eadonly maxAzs?: number;

  /**
   * The number of NAT gateways to create for the VPC.
   */
  //readonly natGateways?: number;

  /**
   * Indicates whether to enable the S3 endpoint for the VPC.
   */
  readonly enableEndpoints?: Array<string>;

  // Define any other properties you want to pass to the VPC construct
}

/**
 * A VPC construct that creates a VPC with public and private subnets.
 */
export class VpcBase extends ec2.Vpc {
  /**
   * The VPC created by the construct.
   */

  constructor(
    scope: Construct,
    id: string,
    props: TmVpcProps,
  ) {
    const defaultProps: TmVpcProps = {
      rangeCidr: props.rangeCidr,
      maxAzs: 2,
      natGateways:  1, // Number of NAT gateways (for private subnets): props.natGateways | 1, // Number of NAT gateways (for private subnets)
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnetWithNat',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnetIsolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    };

    const mergedProps = { ...defaultProps, ...props };

    super(scope, id, mergedProps);

    for (const service of props.enableEndpoints ?? [] ) {
      this.tmAddGatewayEndpoint(service);
    }

    new CfnOutput(this, 'VpcId', {
      value: this.vpcId,
      description: 'VPC ID',
    });
  }

  private tmAddGatewayEndpoint(service: string) {
    const serviceKey = service.toUpperCase() as keyof typeof ec2.GatewayVpcEndpointAwsService;
    this.addGatewayEndpoint(`${service}Endpoint`, {
      service: ec2.GatewayVpcEndpointAwsService[serviceKey],
    });

    const endpointSecurityGroup = new ec2.SecurityGroup(
      this, `${service}EndpointSecurityGroup`, {
        vpc: this,
      },
    );

    endpointSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpcCidrBlock),
      ec2.Port.tcp(443),
    );
  }

}