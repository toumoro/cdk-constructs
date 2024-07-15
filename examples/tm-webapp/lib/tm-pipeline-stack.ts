import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TmPipelineAppStage } from './tm-app-stage';
import * as ssm from 'aws-cdk-lib/aws-ssm';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

  const repositoryBranch =  ssm.StringParameter.valueForStringParameter(
    this, 'repositoryBranch');

  const pipeline = new pipelines.CodePipeline(this, 'TmPipelineStack', {
    crossAccountKeys: true,
    //reuseCrossRegionSupportStacks: true,
    pipelineName: 'TmPipelineStack',
    //synth: new pipelines.ShellStep('Synth', {
    synth: new pipelines.CodeBuildStep('Synth', {
      // From codecommit.Repository.fromRepositoryName
      //input: pipelines.CodePipelineSource.codeCommit(repository, props.repoBranch),
      input: pipelines.CodePipelineSource.connection( 'tm-lcarvalho/cdk-constructs', repositoryBranch, {
        connectionArn: 'arn:aws:codestar-connections:ca-central-1:654654470378:connection/72c0424f-3adc-4157-8f48-962db7dfaefd'
      }),
      additionalInputs: {
        'build': pipelines.CodePipelineSource.connection( 'tm-lcarvalho/cdk-constructs-build', repositoryBranch, {
          connectionArn: 'arn:aws:codestar-connections:ca-central-1:654654470378:connection/72c0424f-3adc-4157-8f48-962db7dfaefd'
        }),
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
