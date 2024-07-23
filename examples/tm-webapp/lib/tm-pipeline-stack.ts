import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TmPipelineAppStage } from './tm-app-stage';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';

export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

  const repository = codecommit.Repository.fromRepositoryName(
    this, 'Infrastructure', 'infrastructure');

  const additionalRepository = codecommit.Repository.fromRepositoryName(
    this, 'Application', 'application');
  
  const branchNameParam = new cdk.CfnParameter(this, 'branchNameParam', {
    type: 'String',
    default: 'main',
  });

  const pipeline = new pipelines.CodePipeline(this, 'TmPipelineStack', {
    crossAccountKeys: true,
    //reuseCrossRegionSupportStacks: true,
    pipelineName: 'TmPipelineStack',
    dockerEnabledForSelfMutation: true,
    dockerEnabledForSynth: true,
    //synth: new pipelines.ShellStep('Synth', {
    synth: new pipelines.CodeBuildStep('Synth', {
      // From codecommit.Repository.fromRepositoryName
      input: pipelines.CodePipelineSource.codeCommit(repository, branchNameParam.valueAsString),
      additionalInputs: {
        'examples/tm-webapp/build': pipelines.CodePipelineSource.codeCommit(additionalRepository, branchNameParam.valueAsString),
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
        'rm -rf cdk.out/asset.*',
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
    },
  }));

}
}

  /* 
  const pipeline = new TmPipeline(this, 'PipelineCdk', {
      pipelineName: 'PipelineCdk',
      repoName: 'tm-lcarvalho/cdk-constructs',
      repoBranch: 'main',
      connectionArn: 'arn:aws:codestar-connections:ca-central-1:654654470378:connection/72c0424f-3adc-4157-8f48-962db7dfaefd',
      primaryOutputDirectory: 'examples/tm-webapp/cdk.out',
      synthCommand: [ 'cd examples/tm-webapp', 
                      'npm install', 
                      'cdk synth', 
                      'find . -iname cdk.out', 
                      'pwd']
    });
    */
