#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TmVpcBaseStack } from '../lib/tm-vpc-base-stack';
import { TmSolrAnsible } from '../lib/tm-ansible-stack';
import { TmSolrEc2Stack } from '../lib/tm-solr-ec2-ansible-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const vpc = new TmVpcBaseStack(app, 'TmSolrVpc', {
  env: env,
  range: '10.98.0.0/16',
  hostedZoneName: 'tm-example.internal',
});

const solr = new TmSolrEc2Stack(app, 'TmSolrEc2Stack', {
        vpc: vpc.vpc,
        env: env,
        crossRegionReferences: true,
        hostedZone: vpc.hostedZone,
});

const ansible = new TmSolrAnsible(app, 'TmSolrAnsibleStack', {});

ansible.addDependency(solr);

app.synth();