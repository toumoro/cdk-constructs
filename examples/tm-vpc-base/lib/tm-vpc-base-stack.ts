import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { TmVpcBase } from '../../../src';

export class CdkVpcbaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new TmVpcBase(this, 'Vpc-CDK', {
      rangeCidr: '10.0.1.0/16',
      enableEndpoints: [ 's3' ],
      });

    cdk.Tags.of(this).add('Project', 'CDK-VPC');
    cdk.Tags.of(this).add('Backup', 'true');

  }
}