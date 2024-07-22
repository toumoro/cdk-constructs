#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { TmVpcStack, TmVpcStackProps } from '../lib/tm-vpc-stack';
import { TmEcsStack, TmEcsStackProps } from '../lib/tm-ecs-stack';
import { TmCloudfrontStack, TmCloudfrontStackProps } from '../lib/tm-cloudfront-stack';
import { CommonStack } from '../lib/tm-common-stack';

const app = new cdk.App();


const caCentral1Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ca-central-1',
}

const usEast1Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
}

const usEast2Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-2',
}

const commonStack = new CommonStack(app, 'CommonStack', {
  crossRegionReferences: true,
  env: caCentral1Env,
});

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
  env: usEast2Env,
  rangeCidr: '10.0.0.0/16',
  vpcName: 'myVpc',
  //enableEndpoints:['s3', 'dynamodb'],
  //maxAzs: 2,
}

const vpcStack1 = new TmVpcStack(app, 'CustomVpcStack1', vpcStackProps1);
const vpcStack2 = new TmVpcStack(app, 'CustomVpcStack2', vpcStackProps2);

const ecsStackProps1: TmEcsStackProps = {
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
  vpc: vpcStack1.vpc,
  customHttpHeaderValue: string;
  domainName: string;
  hostedZoneId: string;
}

const ecsStackProps2: TmEcsStackProps = {
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
  env: usEast2Env,
  vpc: vpcStack2.vpc,
  customHttpHeaderValue: commonStack.customHttpHeaderValue.valueAsString,
  domainName: commonStack.domainName.valueAsString,
  hostedZoneId: commonStack.hostedZoneId.valueAsString,
}


const ecsStack1 = new TmEcsStack(app, 'CustomEcsStack1', ecsStackProps1);
const ecsStack2 = new TmEcsStack(app, 'CustomEcsStack2', ecsStackProps2);

const cloudFrontStackProps: TmCloudfrontStackProps = {
  // additionalCookies: [],
  // retainLogBuckets: false,
  // webAclId: '',
  // errorCachingMinTtl: 300,
  env: usEast1Env,
  crossRegionReferences: true,
  customHttpHeaderValue: commonStack.customHttpHeaderValue.valueAsString,
  domainName: commonStack.domainName.valueAsString,
  hostedZoneId: commonStack.hostedZoneId.valueAsString,
  applicationLoadbalancer1: ecsStack1.loadbalancer,
  applicationLoadbalancer2: ecsStack2.loadbalancer,
}

new TmCloudfrontStack(app, 'CustomCloudfrontStack', cloudFrontStackProps);