#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TmRdsAuroraMysqlServerlessStack } from '../lib/tm-rds-aurora-mysql-serverless-stack';
import { TmVpcbaseStack } from '../../../src/stacks/network/tm-vpc-base-stack';
import { BastionStack } from '../lib/tm-bastion-stack';
import { TmRdsNetworkSecondaryRegionStack } from '../lib/tm-rds-network-secondary-region';
import { TmEcsStack, TmEcsStackProps } from '../lib/tm-ecs-stack';
import { TmCloudfrontStack, TmCloudfrontStackProps } from '../lib/tm-cloudfront-stack';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();

const caCentral1Env = {
  //account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ca-central-1',
}

const caWest1Env = {
  //account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ca-west-1',
}

const usEast1Env = {
  //account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
}

const vpcCaCentralStack = new TmVpcbaseStack(app, 'VpcbaseCaCentralStack',{
  env: caCentral1Env,
});

const vpcCaWestStack = new TmVpcbaseStack(app, 'VpcbaseCaWestStack',{
  env: caWest1Env,
  range: '10.2.0.0/16',
});

const ecsCaCentral1StackProps: TmEcsStackProps = {
  crossRegionReferences: true,
  // allowPublicInternetAccess: true,
  // listenToHttp: true,
  // listenToHttps: false,
  // memoryLimitMiB: 512,
  // cpu: 256,
  // desiredCount: 1,
  // minTaskCount: 1,
  // maxTaskCount: 3,
  // containerPort: 80,
  env: caCentral1Env,
  vpc: vpcCaCentralStack.vpc,
  domainName: 'www.pguv3-accept.quebec.ca',
  hostedZoneId: 'Z09506881MQ4TUQ1SCU3U',
}

const ecsCaWest1StackProps: TmEcsStackProps = {
  crossRegionReferences: true,
  // allowPublicInternetAccess: true,
  // listenToHttp: true,
  // listenToHttps: false,
  // memoryLimitMiB: 512,
  // cpu: 256,
  // desiredCount: 1,
  // minTaskCount: 1,
  // maxTaskCount: 3,
  // containerPort: 80,
  env: caWest1Env,
  vpc: vpcCaWestStack.vpc,
  domainName: 'www.pguv3-accept.quebec.ca',
  hostedZoneId: 'Z09506881MQ4TUQ1SCU3U',
}

const BastionCaWestStack = new BastionStack(app, 'BastionCaWestStack', {
  vpc: vpcCaWestStack.vpc,
  env: caWest1Env,
});

const BastionCaCentralStack = new BastionStack(app, 'BastionCaCentralStack', {
  vpc: vpcCaCentralStack.vpc,
  env: caCentral1Env,
});

//const ecsStack = new TmEcsStack(app, 'CustomEcsStack', ecsStackProps);

const ecsCaCentral1Stack = new TmEcsStack(app, 'EcsCaCentral1Stack', ecsCaCentral1StackProps);


const ecsCaWest1Stack = new TmEcsStack(app, 'EcsCaWest1Stack', ecsCaWest1StackProps);


const cloudFrontStackProps: TmCloudfrontStackProps = {
  crossRegionReferences: true,
  originDnsName: ecsCaCentral1Stack.loadbalancer.loadBalancerDnsName,
  domainName: ecsCaCentral1StackProps.domainName,
  hostedZoneId: ecsCaCentral1StackProps.hostedZoneId,
  env: usEast1Env,
  // additionalCookies: [],
  // retainLogBuckets: false,
  // webAclId: '',
  // errorCachingMinTtl: 300,
  applicationLoadbalancer: ecsCaCentral1Stack.loadbalancer,
}

const cloudfrontStack = new TmCloudfrontStack(app, 'CustomCloudfrontStack', cloudFrontStackProps);

const rdsSecondaryRegion = new TmRdsNetworkSecondaryRegionStack(app, 'rdsNetworkSecondaryRegion', {
  env: caWest1Env,
  vpc: vpcCaWestStack.vpc,
  bastionHost: BastionCaWestStack.securityGroupBastion,
});

const rdsGlobal = new TmRdsAuroraMysqlServerlessStack(app, 'TmRdsAuroraMysqlServerless', {
  env: caCentral1Env,
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

NagSuppressions.addStackSuppressions(ecsCaCentral1Stack, [
  { id: 'AwsSolutions-IAM5', reason: 'The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission.' },
  { id: 'AwsSolutions-IAM4', reason: 'The IAM user, role, or group uses AWS managed policies.' },
  { id: 'AwsSolutions-L1', reason: 'The non-container Lambda function is not configured to use the latest runtime version.' },
  { id: 'AwsSolutions-ELB2', reason: 'The ELB does not have access logs enabled.'},
  { id: 'AwsSolutions-ECS4', reason: 'The ECS Cluster has CloudWatch Container Insights disabled.'},
]);

NagSuppressions.addStackSuppressions(ecsCaWest1Stack, [
  { id: 'AwsSolutions-IAM5', reason: 'The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission.' },
  { id: 'AwsSolutions-IAM4', reason: 'The IAM user, role, or group uses AWS managed policies.' },
  { id: 'AwsSolutions-L1', reason: 'The non-container Lambda function is not configured to use the latest runtime version.' },
  { id: 'AwsSolutions-ELB2', reason: 'The ELB does not have access logs enabled.'},
  { id: 'AwsSolutions-ECS4', reason: 'The ECS Cluster has CloudWatch Container Insights disabled.'},
]);

NagSuppressions.addStackSuppressions(cloudfrontStack, [
  { id: 'AwsSolutions-S1', reason: 'The S3 Bucket has server access logs disabled.' },
  { id: 'AwsSolutions-S10', reason: 'The S3 Bucket or bucket policy does not require requests to use SSL.' },
  { id: 'AwsSolutions-EC2', reason: 'The CloudFront distribution does not have an Origin Request Policy attached.' },
]);

app.synth();