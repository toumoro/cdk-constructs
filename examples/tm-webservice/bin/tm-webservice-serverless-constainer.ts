#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { TmVpcStack, TmVpcStackProps } from '../lib/tm-vpc-stack';
import { TmEcsStack, TmEcsStackProps } from '../lib/tm-ecs-stack';
import * as fs from 'fs';
import { TmCloudfrontStack, TmCloudfrontStackProps } from '../lib/tm-cloudfront-stack';

const app = new cdk.App();
// const regions = ['ca-central-1', 'eu-west-3'];
// const cidrs = ['10.1.0.0/16', '10.3.0.0/16'];
const regions = ['ca-central-1'];
const cidrs = ['10.1.0.0/16'];

// Function to read the parameter names from a file
// function readParametersFromFile(filePath: string): string[] {
//   const fileContents = fs.readFileSync(filePath, 'utf-8');
//   return fileContents.split('\n').map((line: string) => line.trim()).filter((line: string | any[]) => line.length > 0);
// }

// ENVIRONMENTS

const cloufrontEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
}


const environments: cdk.Environment[] = regions.map(region => ({
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: region,
}));


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


// VPC STACKS

const vpcStacks: TmVpcStack[] = vpcStackConfigs.map((vpcStackProps) => {
  return new TmVpcStack(app, `VpcStack-${vpcStackProps.env?.region}`, vpcStackProps);
});


// ECS STACKS CONFIGURATION
const parameters = [
  "AWS_REGION",
  "CLOUDFRONT_API_KEY",
  "CLOUDFRONT_API_SECRET",
  "CLOUDFRONT_CDN_DISTRIBUTION_ID",
  "CLOUDFRONT_DISTRIBUTION_ID",
  "CLOUDFRONT_DISTRIBUTION_SOMMETFRANCO2021",
  "CLOUDFRONT_DISTRIBUTION_SYSTEMDESIGN",
  "COGNITO_CALLBACK_OVERRIDE",
  "COGNITO_CLIENT_ID",
  "COGNITO_CLIENT_SECRET",
  "COGNITO_HOSTED_DOMAIN",
  "DB_DBNAME",
  "DB_DBNAME_V11",
  "DB_DBNAME_V12",
  "DB_HOST",
  "DB_PASSWORD",
  "DB_PORT",
  "DB_REPLICATION_LAG",
  "DB_USER",
  "LB_ACCESS_HEADER_NAME",
  "LB_ACCESS_HEADER_VALUE",
  "REDIS_HOST",
  "SMTP_PASSWORD",
  "SMTP_SERVER",
  "SMTP_USERNAME",
  "SOLR_HOST",
  "SOLR_PORT",
  "TIKA_HOST",
  "TIKA_PORT",
  "TYPO3_CONTEXT",
  "TYPO3_ENVIRONMENT",
  "TYPO3_INDEX_DOMAIN",
  "TYPO3_INDEX_SCHEME",
  "TYPO3_REGION",
  "SOLR_QUEBECCA_INDEX_SCHEME",
  "SOLR_QUEBECCA_INDEX_DOMAIN",
  "SOLR_SDG_INDEX_DOMAIN",
  "SOLR_SDG_INDEX_SCHEME",
]

const additional_secrets_from_parameter_store = {
  'DB_NAME': '/RDS/Exports/DB_NAME'
}

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
    crossRegionReferences: true,
    env: environment,
    vpc: vpcStack.vpc,
    hostedZoneIdParameterName: '/cloudfrontStack/parameters/hostedZoneId',
    customHttpHeaderParameterName: '/cloudfrontStack/parameters/customHttpHeader',
    domainParameterName: '/cloudfrontStack/parameters/domanName',
    secrets_from_ssm_parameter_store: parameters,
    additional_secrets_from_parameter_store: additional_secrets_from_parameter_store,
    application_name: 'tm',
  };
});


// ECS STACKS

const ecsStacks: TmEcsStack[] = ecsStackConfigs.map((ecsStackProps) => {
  return new TmEcsStack(app, `EcsStack-${ecsStackProps.env?.region}`, ecsStackProps);
});


const cloudFrontStackProps: TmCloudfrontStackProps = {
  // additionalCookies: [],
  // retainLogBuckets: false,
  // webAclId: '',
  // errorCachingMinTtl: 300,
  env: cloufrontEnv,
  crossRegionReferences: true,
  hostedZoneIdParameterName: '/cloudfrontStack/parameters/hostedZoneId',
  customHttpHeaderParameterName: '/cloudfrontStack/parameters/customHttpHeader',
  domainParameterName: '/cloudfrontStack/parameters/domanName',
  applicationLoadbalancersDnsNames: ecsStacks.map(ecsStack => ecsStack.loadbalancer.loadBalancerDnsName),
}

const cloudfrontStack = new TmCloudfrontStack(app, 'CustomCloudfrontStack', cloudFrontStackProps);
