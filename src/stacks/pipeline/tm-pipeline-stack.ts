import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct, IConstruct } from 'constructs';
import { DistributionIdsFormat, PipelineSourceType } from '../../config/enums';
import { EnvironmentParameters, PipelineSettings } from '../../config/environment-parameters';
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

    const sourceType = pipelineSettings.sourceType ?? PipelineSourceType.CODECOMMIT;

    // The S3 source needs its buckets before the synth step; keep them so the
    // EventBridge rules (added after buildPipeline) can reference them.
    let s3Source: S3PipelineSource | undefined;
    let synthInput: pipelines.IFileSetProducer;
    let synthAdditionalInputs: Record<string, pipelines.IFileSetProducer>;

    if (sourceType === PipelineSourceType.S3) {
      s3Source = this.s3Source(pipelineSettings, applicationDirectory, removalPolicy);
      synthInput = s3Source.infraInput;
      synthAdditionalInputs = s3Source.additionalInputs;
    } else {
      const repository = codecommit.Repository.fromRepositoryName(
        this, 'Infrastructure', pipelineSettings.infrastructureRepositoryName ?? 'infrastructure');
      const additionalRepository = codecommit.Repository.fromRepositoryName(
        this, 'Application', pipelineSettings.applicationRepositoryName ?? 'application');
      const branchName = cdk.aws_ssm.StringParameter.valueForStringParameter(
        this, pipelineSettings.branchNameParameterName ?? '/pipeline/parameters/branchName');
      synthInput = pipelines.CodePipelineSource.codeCommit(repository, branchName);
      synthAdditionalInputs = {
        [applicationDirectory]: pipelines.CodePipelineSource.codeCommit(additionalRepository, branchName),
      };
    }

    this.pipeline = new pipelines.CodePipeline(this, 'TmPipelineStack', {
      crossAccountKeys: true,
      pipelineName: 'TmPipelineStack',
      // Deploy stacks with a single CloudFormation action instead of the
      // default two-action Prepare (CreateChangeSet) + Deploy (ExecuteChangeSet)
      // pair. This drops the extra "Prepare" step from every stage.
      useChangeSets: false,
      synth: new pipelines.CodeBuildStep('Synth', {
        input: synthInput,
        additionalInputs: synthAdditionalInputs,
        // With `useRepositoryCdkCli`, the CLI is the repository's `aws-cdk`
        // devDependency (installed by `npm ci`), so the synth uses the pinned
        // version. Otherwise a global install of the current version, as before.
        installCommands: pipelineSettings.useRepositoryCdkCli ? ['npm ci'] : ['npm ci', 'npm install -g aws-cdk'],
        // Context lookups (AZs, AMIs) must come from the committed cdk.context.json:
        // a lookup here would not be saved and could change on every run.
        commands: [`${pipelineSettings.useRepositoryCdkCli ? 'npx cdk' : 'cdk'} synth --no-lookups`],
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
      solrBuildContextPath: path.resolve(applicationDirectory, 'docker/solr'),
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

    // The S3 source has no polling: an EventBridge rule per bucket starts the
    // pipeline when CI uploads source.zip. Added after buildPipeline() so the
    // underlying CodePipeline exists.
    if (s3Source) {
      this.addS3SourceTriggers(s3Source);
    }
  }

  /**
   * Creates the S3 source for the pipeline: two versioned, EventBridge-enabled,
   * SSL-enforced buckets (one for the infrastructure source, one for the
   * application), an IAM role GitHub Actions assumes over OIDC to upload
   * `source.zip` into them, and the `CfnOutput`s the consumer reads to set its
   * GitHub variables. Returns the synth-step inputs and the handles the
   * EventBridge triggers need.
   *
   * The GitHub OIDC provider is assumed to already exist in the account (its
   * ARN is referenced, not created).
   *
   * The OIDC trust subject follows `pipelineSettings.sourceEnvironment`: when
   * set, both repositories are trusted on `environment:<name>` (what a GitHub
   * job with `environment: <name>` mints); otherwise on the branch form
   * `ref:refs/heads/<sourceBranch>`.
   */
  private s3Source(
    pipelineSettings: PipelineSettings,
    applicationDirectory: string,
    removalPolicy: cdk.RemovalPolicy,
  ): S3PipelineSource {
    const infrastructureGithubRepo = pipelineSettings.infrastructureGithubRepo;
    const applicationGithubRepo = pipelineSettings.applicationGithubRepo;
    if (!infrastructureGithubRepo || !applicationGithubRepo) {
      throw new Error(
        "pipeline.sourceType 'S3' requires pipeline.infrastructureGithubRepo and pipeline.applicationGithubRepo "
        + "(the GitHub 'owner/repo' of each source repository, used in the OIDC trust subject).");
    }
    const sourceBranch = pipelineSettings.sourceBranch ?? 'prod';
    const sourceEnvironment = pipelineSettings.sourceEnvironment;
    const githubOrgId = pipelineSettings.githubOrgId;
    const infrastructureGithubRepoId = pipelineSettings.infrastructureGithubRepoId;
    const applicationGithubRepoId = pipelineSettings.applicationGithubRepoId;

    const infraSourceBucket = this.sourceBucket('InfraSourceBucket', removalPolicy);
    const appSourceBucket = this.sourceBucket('AppSourceBucket', removalPolicy);

    // Reference the pre-existing GitHub OIDC provider by ARN (do not create one).
    const githubOidcProviderArn = `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com`;

    // When an org (or an individual repository) enables "Use repository and
    // organization IDs in the OIDC subject claim", GitHub embeds numeric IDs
    // INTO the owner and repo segments: `repo:<owner>@<orgId>/<repo>@<repoId>:`.
    // This setting is per-REPOSITORY, so two source repos can mint different
    // forms (verified: the infra repo sends the ID form while the app repo
    // sends the name form). To be correct regardless of each repo's setting —
    // and to survive it being toggled later — we trust BOTH the name-based and
    // the ID-based subject for every repo when the IDs are supplied.
    const idSubjectsAvailable =
      !!githubOrgId && !!infrastructureGithubRepoId && !!applicationGithubRepoId;

    // The suffix is the same for both forms: a GitHub Environment job mints
    // `...:environment:<name>`, a plain branch job `...:ref:refs/heads/<branch>`.
    const suffix = sourceEnvironment
      ? `:environment:${sourceEnvironment}`
      : `:ref:refs/heads/${sourceBranch}`;

    // Returns every subject a repo may legitimately mint: the name-based form
    // always, plus the immutable-ID form when IDs are known. `repo` is
    // 'owner/repo'; `repoId` is that repository's numeric id.
    const subjectsFor = (repo: string, repoId?: string): string[] => {
      const subjects = [`repo:${repo}${suffix}`];
      if (idSubjectsAvailable && repoId) {
        const [owner, name] = repo.split('/');
        subjects.push(`repo:${owner}@${githubOrgId}/${name}@${repoId}${suffix}`);
      }
      return subjects;
    };

    const githubActionsRole = new iam.Role(this, 'GitHubActionsPipelineUploadRole', {
      assumedBy: new iam.FederatedPrincipal(
        githubOidcProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': [
              ...subjectsFor(infrastructureGithubRepo, infrastructureGithubRepoId),
              ...subjectsFor(applicationGithubRepo, applicationGithubRepoId),
            ],
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });

    infraSourceBucket.grantPut(githubActionsRole);
    appSourceBucket.grantPut(githubActionsRole);

    const variableLocation = sourceEnvironment
      ? `in the GitHub Environment named '${sourceEnvironment}' of`
      : 'in';
    new cdk.CfnOutput(this, 'GitHubActionsPipelineRoleArn', {
      value: githubActionsRole.roleArn,
      description: `IAM Role ARN for pipeline S3 upload (set as the AWS_OIDC_ROLE_ARN GitHub variable ${variableLocation} both source repositories)`,
    });
    new cdk.CfnOutput(this, 'InfraSourceBucketName', {
      value: infraSourceBucket.bucketName,
      description: `S3 bucket for the infrastructure source (set as the S3_SOURCE_BUCKET GitHub variable ${variableLocation} the infrastructure repository)`,
    });
    new cdk.CfnOutput(this, 'AppSourceBucketName', {
      value: appSourceBucket.bucketName,
      description: `S3 bucket for the application source (set as the S3_SOURCE_BUCKET GitHub variable ${variableLocation} the application repository)`,
    });

    return {
      infraSourceBucket,
      appSourceBucket,
      infraInput: pipelines.CodePipelineSource.s3(infraSourceBucket, 'source.zip', { trigger: S3Trigger.NONE }),
      additionalInputs: {
        [applicationDirectory]: pipelines.CodePipelineSource.s3(appSourceBucket, 'source.zip', { trigger: S3Trigger.NONE }),
      },
    };
  }

  /** A versioned, EventBridge-enabled, SSL-enforced, private source bucket. */
  private sourceBucket(id: string, removalPolicy: cdk.RemovalPolicy): s3.Bucket {
    return new s3.Bucket(this, id, {
      versioned: true,
      eventBridgeEnabled: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: removalPolicy === cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * One EventBridge rule per source bucket, starting the pipeline when CI
   * uploads `source.zip`. Called after `buildPipeline()`, so the underlying
   * CodePipeline (and its ARN) exists.
   */
  private addS3SourceTriggers(source: S3PipelineSource): void {
    const pipelineArn = this.pipeline.pipeline.pipelineArn;

    const eventBridgeRole = new iam.Role(this, 'EventBridgePipelineRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: {
        StartPipeline: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['codepipeline:StartPipelineExecution'],
              resources: [pipelineArn],
            }),
          ],
        }),
      },
    });

    for (const [id, bucket] of [
      ['InfraSourceS3EventRule', source.infraSourceBucket],
      ['AppSourceS3EventRule', source.appSourceBucket],
    ] as [string, s3.Bucket][]) {
      new events.Rule(this, id, {
        eventPattern: {
          source: ['aws.s3'],
          detailType: ['Object Created'],
          detail: {
            bucket: { name: [bucket.bucketName] },
            object: { key: [{ prefix: 'source.zip' }] },
          },
        },
        targets: [new targets.CodePipeline(this.pipeline.pipeline, { eventRole: eventBridgeRole })],
      });
    }
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

/**
 * Internal handles produced when building the S3 pipeline source, passed from
 * `s3Source()` to the EventBridge-trigger setup after `buildPipeline()`.
 */
interface S3PipelineSource {
  readonly infraSourceBucket: s3.Bucket;
  readonly appSourceBucket: s3.Bucket;
  readonly infraInput: pipelines.IFileSetProducer;
  readonly additionalInputs: Record<string, pipelines.IFileSetProducer>;
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
