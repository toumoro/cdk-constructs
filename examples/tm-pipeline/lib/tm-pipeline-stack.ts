import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { TmPipeline } from '../../../src';

export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // TEST CODE
    // Remove this code when you are done testing
    // and replace with commented code below
    new TmPipeline(this, 'PipelineCdk', {
      pipelineName: 'PipelineCdk',
      repoName: 'toumoro/cdk-constructs',
      repoBranch: 'feat/change-pipeline-source',
      primaryOutputDirectory: 'examples/cdk-pipelinecdk/cdk.out',
      synthCommand: [ 'cd examples/cdk-pipelinecdk',
                      'npm install',
                      'cdk synth',
                      'find . -iname cdk.out',
                      'pwd']
    });
  }

    /*
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
  */
}
