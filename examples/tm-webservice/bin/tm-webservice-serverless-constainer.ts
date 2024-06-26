#!/usr/bin/env node


import * as cdk from 'aws-cdk-lib';
import { TmVpcStack, TmVpcStackProps } from '../lib/tm-vpc-stack';
import { TmEcsStack, TmEcsStackProps } from '../lib/tm-ecs-stack';
import { TmCloudfrontStack, TmCloudfrontStackProps } from '../lib/tm-cloudfront-stack';
import { TmPipelineStack, TmPipelineStackProps } from '../lib/tm-pipeline-stack';

const app = new cdk.App();

const caCentral1Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ca-central-1',
}

const usEast1Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
}

const caWest1Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ca-west-1',
}

const vpcStackProps1: TmVpcStackProps = {
  crossRegionReferences: true,
  env: caCentral1Env,
  rangeCidr: '10.0.0.0/16',
  vpcName: 'myVpc',
  //enableEndpoints:['s3', 'dynamodb'],
  //maxAzs: 2,
}

const vpcStackProps2: TmVpcStackProps = {
  crossRegionReferences: true,
  env: caWest1Env,
  rangeCidr: '10.0.0.0/16',
  vpcName: 'myVpc',
  //enableEndpoints:['s3', 'dynamodb'],
  //maxAzs: 2,
}

const vpcStack1 = new TmVpcStack(app, 'CustomVpcStack1', vpcStackProps1);
const vpcStack2 = new TmVpcStack(app, 'CustomVpcStack2', vpcStackProps2);

const ecsStackProps1: TmEcsStackProps = {
  // crossRegionReferences: true,
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
  vpc: vpcStack1.vpc,
  domainName: 'www.tm-efosso.quebec.ca',
  hostedZoneId: 'Z09593181OB8J3H92ORGI',
}

const ecsStackProps2: TmEcsStackProps = {
  // crossRegionReferences: true,
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
  vpc: vpcStack2.vpc,
  domainName: 'www.tm-efosso.quebec.ca',
  hostedZoneId: 'Z09593181OB8J3H92ORGI',
}

const ecsStack1 = new TmEcsStack(app, 'CustomEcsStack1', ecsStackProps1);
const ecsStack2 = new TmEcsStack(app, 'CustomEcsStack2', ecsStackProps2);

const cloudFrontStackProps: TmCloudfrontStackProps = {
  crossRegionReferences: true,
  //originDnsName: ecsStack.loadbalancer.loadBalancerDnsName,
  domainName: ecsStackProps1.domainName,
  hostedZoneId: ecsStackProps1.hostedZoneId,
  env: usEast1Env,
  // additionalCookies: [],
  // retainLogBuckets: false,
  // webAclId: '',
  // errorCachingMinTtl: 300,
  applicationLoadbalancer1: ecsStack1.loadbalancer,
  applicationLoadbalancer2: ecsStack2.loadbalancer,
}

const cloudfrontStack = new TmCloudfrontStack(app, 'CustomCloudfrontStack', cloudFrontStackProps);

// const  pipelineStackProps: TmPipelineStackProps = {
//   env: caCentral1Env,
//   cluster: ecsStack.cluster,
//   service: ecsStack.fargateService,
// }
// const myPipelineStack = new TmPipelineStack(app, 'pipeline', pipelineStackProps);
