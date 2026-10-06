import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct, IConstruct } from 'constructs';
import { DistributionIdsFormat } from '../../config/enums';
import { EnvironmentParameters } from '../../config/environment-parameters';
import { TmParameterNames } from '../../config/parameter-names';
import { TmWebappAppStage, TmWebappStackIds } from '../../stage/tm-webapp-app-stage';

/**
 * Adds a repository's own stacks to the application stage.
 */
export interface ITmAppStageExtension {
  /**
   * Called once the package stacks exist, before the stage is added to the
   * pipeline (CDK Pipelines synthesizes the stage at that point).
   */
  extend(stage: TmWebappAppStage): void;
}

/**
 * Props for `TmPipelineStack`.
 */
export interface TmPipelineStackProps extends cdk.StackProps {
  /**
   * Settings of the environment.
   */
  readonly parameters: EnvironmentParameters;

  /**
   * Directory where the pipeline checks out the application repository,
   * relative to the infrastructure repository root (where `cdk.json` is).
   * It is the Docker build context.
   *
   * @default 'build'
   */
  readonly applicationDirectory?: string;

  /**
   * Local directory of error pages, see `TmWebappAppStageProps.errorPagesPath`.
   *
   * @default - CloudFront's default error responses
   */
  readonly errorPagesPath?: string;

  /**
   * Id of the application stage. Part of every application stack name.
   *
   * @default 'AppStage'
   */
  readonly stageId?: string;

  /**
   * Stack ids of the application stage.
   *
   * @default - see `TmWebappStackIds`
   */
  readonly stackIds?: TmWebappStackIds;

  /**
   * Adds the repository's own stacks to the application stage.
   *
   * @default - only the package stacks
   */
  readonly appStageExtension?: ITmAppStageExtension;
}

/**
 * Self-mutating CodePipeline that synthesizes the infrastructure repository
 * with the application repository checked out in it, deploys
 * `TmWebappAppStage`, then invalidates the CloudFront distributions.
 *
 * The synth runs without context lookups, so `cdk.context.json` must be
 * committed with every value the app needs (run `cdk synth` locally first).
 *
 * Every CloudFormation resource of this stack gets the removal policy from the
 * `removalPolicy` context value (`RETAIN` or `DESTROY`, default `RETAIN`).
 */
export class TmPipelineStack extends cdk.Stack {
  /** The pipeline. */
  public readonly pipeline: pipelines.CodePipeline;
  /** The application stage. */
  public readonly appStage: TmWebappAppStage;
  /**
   * Stacks CodePipeline creates for its artifact buckets in the other regions
   * of the stage (us-east-1 with a WebACL). They are deployed with this stack.
   */
  public readonly crossRegionSupportStacks: cdk.Stack[];

  constructor(scope: Construct, id: string, props: TmPipelineStackProps) {
    super(scope, id, props);

    const params = props.parameters;
    const pipelineSettings = params.pipeline ?? {};
    const applicationDirectory = props.applicationDirectory ?? 'build';

    const removalPolicy = toRemovalPolicy(this.node.tryGetContext('removalPolicy') ?? 'RETAIN');
    cdk.Aspects.of(this).add(new ApplyRemovalPolicyAspect(removalPolicy));

    const repository = codecommit.Repository.fromRepositoryName(
      this, 'Infrastructure', pipelineSettings.infrastructureRepositoryName ?? 'infrastructure');
    const additionalRepository = codecommit.Repository.fromRepositoryName(
      this, 'Application', pipelineSettings.applicationRepositoryName ?? 'application');
    const branchName = cdk.aws_ssm.StringParameter.valueForStringParameter(
      this, pipelineSettings.branchNameParameterName ?? '/pipeline/parameters/branchName');

    this.pipeline = new pipelines.CodePipeline(this, 'TmPipelineStack', {
      crossAccountKeys: true,
      pipelineName: 'TmPipelineStack',
      synth: new pipelines.CodeBuildStep('Synth', {
        input: pipelines.CodePipelineSource.codeCommit(repository, branchName),
        additionalInputs: {
          [applicationDirectory]: pipelines.CodePipelineSource.codeCommit(additionalRepository, branchName),
        },
        installCommands: ['npm ci', 'npm install -g aws-cdk'],
        // Context lookups (AZs, AMIs) must come from the committed cdk.context.json:
        // a lookup here would not be saved and could change on every run.
        commands: ['cdk synth --no-lookups'],
        primaryOutputDirectory: './cdk.out',
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ['ec2:DescribeAvailabilityZones', 'ssm:GetParameter'],
            resources: ['*'],
          }),
        ],
      }),
    });

    this.appStage = new TmWebappAppStage(this, props.stageId ?? 'AppStage', {
      env: { account: params.account, region: params.region ?? 'ca-central-1' },
      parameters: params,
      buildContextPath: path.resolve(applicationDirectory),
      errorPagesPath: props.errorPagesPath,
      stackIds: props.stackIds,
    });
    props.appStageExtension?.extend(this.appStage);

    const post: pipelines.Step[] = [];
    if (params.cloudfront) {
      post.push(this.invalidationStep(params));
    }
    this.pipeline.addStage(this.appStage, { post });

    // Built now rather than at synth time, so the support stacks can be
    // configured (e.g. cdk-nag suppressions) like this one.
    this.pipeline.buildPipeline();
    this.crossRegionSupportStacks = Object.values(this.pipeline.pipeline.crossRegionSupport).map(support => support.stack);
  }

  /**
   * Invalidates every distribution listed in the distribution-ID parameter,
   * read when the step runs.
   */
  private invalidationStep(params: EnvironmentParameters): pipelines.Step {
    const parameterName = params.cloudfront?.distributionIdsParameterName
      ?? TmParameterNames.cloudfrontDistributionIds(params.environmentName);
    const format = params.cloudfront?.distributionIdsFormat ?? DistributionIdsFormat.JSON_MAP;
    const ids = format === DistributionIdsFormat.PLAIN
      ? '"$DISTRIBUTION_IDS"'
      : '$(echo "$DISTRIBUTION_IDS" | jq -r \'.[]\')';

    return new pipelines.CodeBuildStep('CloudFront invalidation', {
      commands: [
        `DISTRIBUTION_IDS=$(aws ssm get-parameter --name '${parameterName}' --query Parameter.Value --output text)`
        + ` && for distribution in ${ids}; do`
        + ' echo "Invalidation de la cache pour la distribution: $distribution"'
        + ' && aws cloudfront create-invalidation --distribution-id "$distribution" --paths \'/*\';'
        + ' done',
      ],
      rolePolicyStatements: [
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [`arn:${this.partition}:ssm:${params.region ?? 'ca-central-1'}:${params.account}:parameter${parameterName}`],
        }),
        new iam.PolicyStatement({
          actions: ['cloudfront:CreateInvalidation'],
          resources: ['*'],
        }),
      ],
    });
  }
}

class ApplyRemovalPolicyAspect implements cdk.IAspect {
  constructor(private readonly policy: cdk.RemovalPolicy) {}

  public visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(this.policy);
    }
  }
}

function toRemovalPolicy(policy: string): cdk.RemovalPolicy {
  switch (policy.toUpperCase()) {
    case 'DESTROY':
      return cdk.RemovalPolicy.DESTROY;
    case 'RETAIN':
      return cdk.RemovalPolicy.RETAIN;
    default:
      throw new Error(`Unknown removal policy: ${policy}`);
  }
}
