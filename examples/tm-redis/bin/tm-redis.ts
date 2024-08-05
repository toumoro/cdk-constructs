#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TmRedisStack } from '../lib/tm-redis-stack';
import { TmRedisGlobalStack } from '../lib/tm-redis-global-stack';
import { TmVpcbaseStack } from '../lib/tm-vpc-base-stack';
import { TmBastionStack } from '../lib/tm-bastion-stack';
//import { CrossRegionParameterStack } from '../lib/tm-cross-region-parameter-stack';

const app = new cdk.App();

const envCaCentral1 = {
  region: 'ca-central-1',
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const envEuWest3 = {
  region: 'eu-west-3',
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const vpcCaCentral1Stack = new TmVpcbaseStack(app, 'TmVpcCaCentral1Stack', {
  crossRegionReferences: true,
  env: envCaCentral1,
  range: '10.11.0.0/16',
});

const vpcEuWest3Stack = new TmVpcbaseStack(app, 'TmVpcEuWest3Stack', {
  crossRegionReferences: true,
  env: envEuWest3,
  range: '10.13.0.0/16',
});

const tmRedisGlobal = new TmRedisGlobalStack(app, 'TmRedisGlobalStack', {
  crossRegionReferences: true,
  env: envCaCentral1,
  vpc: vpcCaCentral1Stack.vpc,
});

const TmBastion = new TmBastionStack(app, 'TmBastionRedisStack', {
  env: envEuWest3,
  vpc: vpcEuWest3Stack.vpc,
});
const TmBastion2 = new TmBastionStack(app, 'TmBastionRedis2Stack', {
  env: envEuWest3,
  vpc: vpcEuWest3Stack.vpc,
});
console.log(tmRedisGlobal.globalReplicationGroupId);

const tmRedisEuWest3Stack = new TmRedisStack(app, 'TmRedisEuWest3Stack', {
  crossRegionReferences: true,
  env: envEuWest3,
  vpc: vpcEuWest3Stack.vpc,
  globalReplicationGroupId: tmRedisGlobal.globalReplicationGroupId,
  allowFromConstructs: { bastion: TmBastion.bastionHost, TmBastion2: TmBastion2.bastionHost},
});
tmRedisEuWest3Stack.addDependency(tmRedisGlobal);