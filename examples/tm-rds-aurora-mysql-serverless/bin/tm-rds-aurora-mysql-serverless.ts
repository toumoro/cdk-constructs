#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TmRdsAuroraMysqlServerlessStack } from '../lib/tm-rds-aurora-mysql-serverless-stack';
import { TmVpcbaseStack } from '../../../src/stacks/network/tm-vpc-base-stack';
import { BastionStack } from '../lib/tm-bastion-stack';
import { TmRdsNetworkSecondaryRegionStack } from '../lib/tm-rds-network-secondary-region';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();

const envCaCentral  = { region: 'ca-central-1' };
const envCaWest = { region: 'ca-west-1' };


const vpcCaCentralStack = new TmVpcbaseStack(app, 'VpcbaseCaCentralStack',{
  env: envCaCentral,
});

const vpcCaWestStack = new TmVpcbaseStack(app, 'VpcbaseCaWestStack',{
  env: envCaWest,
  range: '10.2.0.0/16',
});

const BastionCaWestStack = new BastionStack(app, 'BastionCaWestStack', {
  vpc: vpcCaWestStack.vpc,
  env: envCaWest,
});

const BastionCaCentralStack = new BastionStack(app, 'BastionCaCentralStack', {
  vpc: vpcCaCentralStack.vpc,
  env: envCaCentral,
});

const rdsSecondaryRegion = new TmRdsNetworkSecondaryRegionStack(app, 'rdsNetworkSecondaryRegion', {
  env: envCaWest,
  vpc: vpcCaWestStack.vpc,
  bastionHost: BastionCaWestStack.securityGroupBastion,
});

const rdsGlobal = new TmRdsAuroraMysqlServerlessStack(app, 'TmRdsAuroraMysqlServerless', {
  env: envCaCentral,
  vpc: vpcCaCentralStack.vpc,
  bastionHost: BastionCaCentralStack.securityGroupBastion,
  enableGlobal: true,
});

Aspects.of(app).add(new AwsSolutionsChecks({verbose: true}));

NagSuppressions.addStackSuppressions(vpcCaWestStack, [
  { id: 'AwsSolutions-VPC7', reason: 'Thats is not a solution and just a test' },
]);

NagSuppressions.addStackSuppressions(BastionCaWestStack, [
  { id: 'AwsSolutions-IAM5', reason: 'Thats is not a solution and just a test' },
  { id: 'AwsSolutions-EC26', reason: 'Thats is not a solution and just a test' },
  { id: 'AwsSolutions-EC28', reason: 'Thats is not a solution and just a test' },
  { id: 'AwsSolutions-EC29', reason: 'Thats is not a solution and just a test' },
]);
NagSuppressions.addStackSuppressions(vpcCaCentralStack, [
  { id: 'AwsSolutions-VPC7', reason: 'Thats is not a solution and just a test' },
]);

NagSuppressions.addStackSuppressions(BastionCaCentralStack, [
  { id: 'AwsSolutions-IAM5', reason: 'Thats is not a solution and just a test' },
  { id: 'AwsSolutions-EC26', reason: 'Thats is not a solution and just a test' },
  { id: 'AwsSolutions-EC28', reason: 'Thats is not a solution and just a test' },
  { id: 'AwsSolutions-EC29', reason: 'Thats is not a solution and just a test' },
]);


NagSuppressions.addStackSuppressions(rdsSecondaryRegion, []);

NagSuppressions.addStackSuppressions(rdsGlobal, [
  { id: 'AwsSolutions-SMG4', reason: 'The secret does not have automatic rotation scheduled.' },
  { id: 'AwsSolutions-RDS6', reason: 'IAM Database Authentication enabled' },
  { id: 'AwsSolutions-RDS10', reason: 'The RDS DB instance does not have deletion protection enabled' },
  { id: 'AwsSolutions-RDS11', reason: 'Using a default endpoint port 3306' },
  { id: 'AwsSolutions-RDS14', reason: 'Aurora Serverless Clusters do not support Backtracking ' },
  { id: 'AwsSolutions-IAM4', reason: 'Replace AWS managed policies with system specific (customer) managed policies - Policy AmazonRDSEnhancedMonitoringRole' },
]);

app.synth();