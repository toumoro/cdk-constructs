#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TmScalingOverrideStack } from '../lib/tm-scaling-override-stack';

const app = new cdk.App();

new TmScalingOverrideStack(app, 'TmScalingOverrideStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
