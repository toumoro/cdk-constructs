import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TmPipelineAppStage } from './tm-app-stage';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

  const repository = codecommit.Repository.fromRepositoryName(
    this, 'Infrastructure', 'infrastructure');

  const additionalRepository = codecommit.Repository.fromRepositoryName(
    this, 'Application', 'application');
  
  const branchNameParam = ssm.StringParameter.valueForStringParameter(
    this, 'branchNameParam');

  const pipeline = new pipelines.CodePipeline(this, 'TmPipelineStack', {
    crossAccountKeys: true,
    pipelineName: 'TmPipelineStack',
    synth: new pipelines.CodeBuildStep('Synth', {
      input: pipelines.CodePipelineSource.codeCommit(repository, branchNameParam),
      additionalInputs: {
        'examples/tm-webapp/build': pipelines.CodePipelineSource.codeCommit(additionalRepository, branchNameParam),
      },
      // Commands to run in the synth step
      installCommands: ['npm install', 'npm ci', 'npm install -g aws-cdk'],
      commands: [
        'ls -al',
        'cd examples/tm-webapp',
        'npm install',
        'cdk synth',
        'find . -iname cdk.out',
        'ls -al',
        'pwd',
        //'rm -rf cdk.out/asset.*',
      ],
      primaryOutputDirectory: 'examples/tm-webapp/cdk.out',
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: ['ec2:DescribeAvailabilityZones'],
          resources: ['*'],
        }),
      ],
      
    }),
  });


  pipeline.addStage(new TmPipelineAppStage(this, 'AppStage', {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'ca-central-1'
    }
  }));
  
}
}
