import * as cdk from 'aws-cdk-lib';
import { TmVpcBase } from '../src';


test('VPCBase Construct creates a VPC with the specified CIDR block', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  new TmVpcBase(stack, 'TestVPC', {
    rangeCidr: '10.0.1.0/16',
    maxAzs: 2,
    natGateways: 1,
    enableEndpoints: ['s3', 'dynamodb'],
    createInternetGateway: true,
  });

});
