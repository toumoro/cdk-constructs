import * as cdk from 'aws-cdk-lib/core';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface TmPipelineStackProps extends cdk.StackProps {
  readonly vpc?: ec2.IVpc;
  readonly service: ecs.FargateService;
  readonly cluster: ecs.ICluster;
}

export class TmPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TmPipelineStackProps) {

    super(scope, id, props);

    // Define CodeCommit repository
    const codecommitRepo = new codecommit.Repository(this, 'MyRepo', {
      repositoryName: 'my-repo'
    });

    // Define ECR repository
    const ecrRepo = new ecr.Repository(this, 'ecrRepo', {
      repositoryName: 'app',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,

    })

    // Define CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true,
      },
      environmentVariables: {
        'AWS_ACCOUNT_ID': { value: cdk.Aws.ACCOUNT_ID },
        'AWS_DEFAULT_REGION': { value: cdk.Aws.REGION },
        'IMAGE_REPO_NAME': { value: ecrRepo.repositoryName },
      },
    });

        // Define the policy statement
        const ecrPolicyStatement = new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "ecr:CompleteLayerUpload",
            "ecr:GetAuthorizationToken",
            "ecr:UploadLayerPart",
            "ecr:InitiateLayerUpload",
            "ecr:BatchCheckLayerAvailability",
            "ecr:PutImage"
          ],
          resources: ["arn:aws:ecr:" + cdk.Aws.REGION + ":" + cdk.Aws.ACCOUNT_ID + ":repository/" + ecrRepo.repositoryName]
        });
    
        const allEcrPolicyStatement = new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "ecr:GetAuthorizationToken",
          ],
          resources: ["*"]
        });

        const allEcsPolicyStatement = new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
              "ecs:DescribeServices",
              "ecs:DescribeTaskDefinition",
              "ecs:DescribeTasks",
              "ecs:ListTasks",
              "ecs:RegisterTaskDefinition",
              "ecs:TagResource",
              "ecs:UpdateService"
          ],
          resources: ["*"]
      });

            // Attach the policy to the CodeBuild project role
    buildProject.addToRolePolicy(ecrPolicyStatement);
    buildProject.addToRolePolicy(allEcrPolicyStatement);

    // Define CodePipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'MyPipeline',
    });

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: 'CodeCommit_Source',
          repository: codecommitRepo,
          output: sourceOutput
        })
      ]
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'CodeBuild',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput]
        })
      ]
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'ECS_Deploy',
          service: props.service,
          input: buildOutput
        })
      ]
    });


            // Attach the policy to the CodeBuild project role
            pipeline.addToRolePolicy(allEcsPolicyStatement);

  }
}
