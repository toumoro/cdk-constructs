import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { TmPipeline } from '../../../src';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    new TmPipeline(this, 'PipelineCdk', {
      pipelineName: 'PipelineCdk',
      repoName: 'cdk-constructs',
      repoBranch: 'main',
      primaryOutputDirectory: 'examples/cdk-pipelinecdk/cdk.out',
      synthCommand: [ 'cd examples/cdk-pipelinecdk', 
                      'npm install', 
                      'cdk synth', 
                      'find . -iname cdk.out', 
                      'pwd']
    });
  }
}
