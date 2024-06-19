import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcBase, TmVpcProps } from './vpc/vpc-base';
import { CfnOutput } from 'aws-cdk-lib';
import * as ec2  from 'aws-cdk-lib/aws-ec2';
import * as ssm  from 'aws-cdk-lib/aws-ssm';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface TmVpcStackProps extends cdk.StackProps {
  readonly rangeCidr: string;
  readonly vpcName?: string;
  readonly enableEndpoints?: Array<string>;
  readonly maxAzs?: number;
}

export class TmVpcStack extends cdk.Stack {
 
  public readonly vpc: ec2.IVpc;
  
  constructor(scope: Construct, id: string, props: TmVpcStackProps) {

    super(scope, id, props);

    const vpcProps: TmVpcStackProps = {
      crossRegionReferences: true,
      rangeCidr: props.rangeCidr,
      vpcName: props.vpcName,
      enableEndpoints: props.enableEndpoints,
      maxAzs: props.maxAzs,
    };
    this.vpc = new VpcBase(this, 'MyCustomVpc', vpcProps);
    
  
      // Output the VPC ID
      new cdk.CfnOutput(this, 'VpcId', {
        value: this.vpc.vpcId,
        exportName: 'TmCustomVpcId',
      });

  }
}
