import * as cdk from 'aws-cdk-lib';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { TmPipeline } from '../../../src';

export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ** Pipeline with CodeCommit source **
    new TmPipeline(this, 'PipelineCdkCodeCommit', {
      pipelineName: 'PipelineCdkCodeCommit',
      repoName: 'cdk-constructs',
      repoBranch: 'main',
      primaryOutputDirectory: 'examples/cdk-pipelinecdk/cdk.out',
      synthCommand: [ 'cd examples/cdk-pipelinecdk',
                      'npm install',
                      'cdk synth',
                      'find . -iname cdk.out',
                      'pwd']
    });

    // ** Pipeline with GitHub source **
    const githubSource = pipelines.CodePipelineSource.gitHub("toumoro/cdk-constructs", "main");

    new TmPipeline(this, 'PipelineCdkGithub', {
      pipelineName: 'PipelineCdkGithub',
      source: githubSource,
      primaryOutputDirectory: 'examples/tm-pipeline/cdk.out',
      synthCommand: [ 'cd examples/tm-pipeline',
                      'npm install',
                      'cdk synth',
                      'find . -iname cdk.out',
                      'pwd']
    });

  }
}
