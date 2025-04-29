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

    // ** Pipeline with S3 source **
    const sourceBucket = new s3.Bucket(this, 'Infrastructure Source Bucket',
    {
        versioned: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        lifecycleRules: [
          {
            noncurrentVersionExpiration: cdk.Duration.days(30),
            noncurrentVersionsToRetain: 10,
          },
        ],
      }
      );

    // Deny HTTP (unencrypted) requests
    sourceBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowSSLRequestsOnly',
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:*'],
      resources: [
        sourceBucket.bucketArn,
        `${sourceBucket.bucketArn}/*`,
      ],
      conditions: {
        Bool: {
          'aws:SecureTransport': 'false',
        },
      },
    }));

    // Should be triggered by S3 put, but the event bridge rule doesn't seem to trigger.
    const s3Source = pipelines.CodePipelineSource.s3(sourceBucket, 'source.zip', { trigger: codepipeline_actions.S3Trigger.EVENTS });

    new TmPipeline(this, 'PipelineCdkS3', {
      pipelineName: 'PipelineCdkS3',
      source: s3Source,
      primaryOutputDirectory: 'examples/tm-pipeline/cdk.out',
      synthCommand: [ 'cd examples/tm-pipeline',
                      'npm install',
                      'cdk synth',
                      'find . -iname cdk.out',
                      'pwd']
    });

  }
}
