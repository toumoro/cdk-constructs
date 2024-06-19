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

const vpcStackProps: TmVpcStackProps = {
  crossRegionReferences: true,
  env: caCentral1Env,
  rangeCidr: '10.0.0.0/16',
  vpcName: 'myVpc',
  //enableEndpoints:['s3', 'dynamodb'],
  //maxAzs: 2,
}

const vpcStack = new TmVpcStack(app, 'CustomVpcStack', vpcStackProps);

const ecsStackProps: TmEcsStackProps = {
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
  vpc: vpcStack.vpc,
  domainName: 'www.tm-efosso.quebec.ca',
  hostedZoneId: 'Z09593181OB8J3H92ORGI',
}

const ecsStack = new TmEcsStack(app, 'CustomEcsStack', ecsStackProps);

const cloudFrontStackProps: TmCloudfrontStackProps = {
  crossRegionReferences: true,
  originDnsName: ecsStack.loadbalancer.loadBalancerDnsName,
  domainName: ecsStackProps.domainName,
  hostedZoneId: ecsStackProps.hostedZoneId,
  env: usEast1Env,
  // additionalCookies: [],
  // retainLogBuckets: false,
  // webAclId: '',
  // errorCachingMinTtl: 300,
  applicationLoadbalancer: ecsStack.loadbalancer,
}

const cloudfrontStack = new TmCloudfrontStack(app, 'CustomCloudfrontStack', cloudFrontStackProps);

// const  pipelineStackProps: TmPipelineStackProps = {
//   env: caCentral1Env,
//   cluster: ecsStack.cluster,
//   service: ecsStack.fargateService,
// }
// const myPipelineStack = new TmPipelineStack(app, 'pipeline', pipelineStackProps);