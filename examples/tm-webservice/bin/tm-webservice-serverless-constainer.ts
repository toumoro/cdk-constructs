#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { TmVpcStack, TmVpcStackProps } from '../lib/tm-vpc-stack';
import { TmEcsStack, TmEcsStackProps } from '../lib/tm-ecs-stack';
import { CommonStack } from '../lib/tm-common-stack';
import { Environment } from 'aws-cdk-lib/aws-appconfig';
import { TmCloudfrontStack, TmCloudfrontStackProps } from '../lib/tm-cloudfront-stack';

const app = new cdk.App();
const regions = ['ca-central-1','eu-west-3'];
const cidrs = ['10.1.0.0/16','10.3.0.0/16'];

// ENVIRONMENTS

const cloufrontEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
}

// const caCentral1Env = {
//   account: process.env.CDK_DEFAULT_ACCOUNT,
//   region: 'ca-central-1',
// }
// const euWest3Env = {
//   account: process.env.CDK_DEFAULT_ACCOUNT,
//   region: 'eu-west-3',
// }

const environments: cdk.Environment[] = regions.map(region => ({
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: region,
}));

// console.log(environments);


// COMMON STACK

// const commonStack = new CommonStack(app, 'CommonStack', {
//   crossRegionReferences: true,
//   env: euWest3Env,
// });

const commonStack = new CommonStack(app, 'CommonStack', {
  crossRegionReferences: true,
  env: environments[0],
});

// VPC STACKS CONFIGURATION

const vpcStackConfigs: TmVpcStackProps[] = environments.map((environment, index) => {
  const cidr = cidrs[index];
  return {
    //enableEndpoints:['s3', 'dynamodb'],
    //maxAzs: 2,
    crossRegionReferences: true,
    env: environment,
    rangeCidr: cidr,
    vpcName: `VPC-${environment.region}`,
  }
});

 console.log(vpcStackConfigs[0]);

// VPC STACKS

const vpcStacks: TmVpcStack[] = vpcStackConfigs.map((vpcStackProps) => {
  return new TmVpcStack(app, `VpcStack-${vpcStackProps.env?.region}`, vpcStackProps);
});

//console.log(vpcStacks[0]);


// ECS STACKS CONFIGURATION

const ecsStackConfigs: TmEcsStackProps[] = vpcStacks.map((vpcStack, index) => {
  const environment: cdk.Environment = environments[index];
  return {
    // allowPublicInternetAccess: true,
    // listenToHttp: true,
    // listenToHttps: false,
    // memoryLimitMiB: 512,
    // cpu: 256,
    // desiredCount: 1,
    // minTaskCount: 1,
    // maxTaskCount: 3,
    // containerPort: 80,
    env: environment,
    vpc: vpcStack.vpc,
    customHttpHeaderValue: commonStack.customHttpHeaderValue.valueAsString,
    domainName: commonStack.domainName.valueAsString,
    hostedZoneId: commonStack.hostedZoneId.valueAsString,
    crossRegionReferences: true,
  };
});

//console.log(ecsStackConfigs);

// ECS STACKS

const ecsStacks: TmEcsStack[] = ecsStackConfigs.map((ecsStackProps) => {
  return new TmEcsStack(app, `EcsStack-${ecsStackProps.env?.region}`, ecsStackProps);
});

// console.log(ecsStacks);

// const ecsStackConfigs: TmEcsStackProps[] = environments.map(environment => ({
//   crossRegionReferences: true,
//   // allowPublicInternetAccess: true,
//   // listenToHttp: true,
//   // listenToHttps: false,
//   // memoryLimitMiB: 512,
//   // cpu: 256,
//   // desiredCount: 1,
//   // minTaskCount: 1,
//   // maxTaskCount: 3,
//   // containerPort: 80,
//   env: usEast2Env,
//   vpc: vpcStack2.vpc,
//   customHttpHeaderValue: commonStack.customHttpHeaderValue.valueAsString,
//   domainName: commonStack.domainName.valueAsString,
//   hostedZoneId: commonStack.hostedZoneId.valueAsString,
// }));

// console.log(ecsStackConfigs);


// const ecsStack1 = new TmEcsStack(app, 'CustomEcsStack1', ecsStackProps1);
// const ecsStack2 = new TmEcsStack(app, 'CustomEcsStack2', ecsStackProps2);

const cloudFrontStackProps: TmCloudfrontStackProps = {
  // additionalCookies: [],
  // retainLogBuckets: false,
  // webAclId: '',
  // errorCachingMinTtl: 300,
  env: cloufrontEnv,
  crossRegionReferences: true,
  //customHttpHeaderValue: ssm.StringParameter.valueForSecureStringParameter(this, 'my-secure-parameter-name', 1),
  //domainName: ssm.StringParameter.valueForSecureStringParameter(this, 'my-secure-parameter-name', 1),
  //hostedZoneIdParameterName: '/cloudfrontStack/parameters/hostedZoneId',
  customHttpHeaderValue: commonStack.customHttpHeaderValue.valueAsString,
  domainName: commonStack.domainName.valueAsString,
  hostedZoneId: commonStack.hostedZoneId.valueAsString,
  applicationLoadbalancers: ecsStacks.map(ecsStack => ecsStack.loadbalancer),
}

const cloudfrontStack = new TmCloudfrontStack(app, 'CustomCloudfrontStack', cloudFrontStackProps);
// console.log(cloudfrontStack);
