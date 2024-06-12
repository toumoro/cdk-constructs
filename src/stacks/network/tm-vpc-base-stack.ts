import * as cdk from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { TmVpcBase } from '../../network/vpc-base';

interface VpcBaseStackProps extends cdk.StackProps {
  range?: string;
}

export class TmVpcbaseStack extends cdk.Stack {
  public readonly vpc: IVpc;
  constructor(scope: Construct, id: string, props?: VpcBaseStackProps) {
    super(scope, id, props);


    this.vpc = new TmVpcBase(this, 'Vpc-CDK', {
      rangeCidr: props?.range || '10.1.0.0/16',
      enableEndpoints: ['s3'],

    });
  }

}