import { ContainerTopology, DistributionIdsFormat, FalStorage, PipelineSourceType, ServiceIamUser } from './enums';
import { TmSecretField } from '../stacks/compute/tm-ecs-stack';

export { TmSecretField } from '../stacks/compute/tm-ecs-stack';

/**
 * Network settings.
 */
export interface VpcSettings {
  /**
   * CIDR range of the VPC, e.g. `10.3.0.0/16`.
   */
  readonly cidr: string;

  /**
   * Name of the private hosted zone attached to the VPC, e.g. `epq-site-web.internal`.
   */
  readonly hostedZoneName: string;
}

/**
 * Bastion host settings.
 */
export interface BastionSettings {
  /**
   * EC2 instance type.
   *
   * @default 't3.small'
   */
  readonly instanceType?: string;
}

/**
 * Aurora MySQL settings.
 */
export interface RdsSettings {
  /**
   * Instance type of a provisioned writer, e.g. `t3.medium`.
   *
   * @default - an Aurora Serverless v2 writer
   */
  readonly instanceType?: string;

  /**
   * Enables Performance Insights. Must be `false` on t3 instance classes,
   * which don't support it.
   *
   * @default true
   */
  readonly performanceInsights?: boolean;
}

/**
 * ElastiCache Redis settings.
 */
export interface RedisSettings {
  /**
   * Cache node type.
   *
   * @default 'cache.t3.micro'
   */
  readonly cacheNodeType?: string;

  /**
   * Number of replicas. With at least one replica, automatic failover and
   * Multi-AZ are enabled.
   *
   * @default 0
   */
  readonly replicasPerNodeGroup?: number;
}

/**
 * Apache Solr search instance settings.
 */
export interface SolrSettings {
  /**
   * EC2 instance type of the Solr instance.
   *
   * @default 't3.medium'
   */
  readonly instanceType?: string;

  /**
   * Data volume size in GiB (gp3, retained).
   *
   * @default 30
   */
  readonly ebsVolumeSize?: number;

  /**
   * Solr Java memory settings (`SOLR_JAVA_MEM`).
   *
   * @default '-Xms1g -Xmx1g'
   */
  readonly solrJavaMem?: string;

  /**
   * Solr JVM options (`SOLR_OPTS`).
   *
   * @default '-XX:-UseLargePages'
   */
  readonly solrOpts?: string;

  /**
   * Solr cores enabled by the TYPO3 Solr extension, a space-separated list.
   *
   * @default 'french english'
   */
  readonly enabledCores?: string;

  /**
   * A record name of the Solr instance in the VPC private hosted zone.
   *
   * @default 'solr'
   */
  readonly recordName?: string;
}

/**
 * ECS service settings.
 */
export interface EcsSettings {
  /**
   * Container layout of the task.
   *
   * @default ContainerTopology.APACHE_PHP_FPM
   */
  readonly containerTopology?: ContainerTopology;

  /**
   * Dockerfile of the `web` container, relative to the build context.
   *
   * @default - `docker/php-apache/Dockerfile` (SINGLE), `docker/tm-apache/Dockerfile`
   * (APACHE_PHP_FPM) or `docker/nginx/Dockerfile` (NGINX_PHP_FPM)
   */
  readonly webDockerfile?: string;

  /**
   * Dockerfile of the `php-fpm` container, relative to the build context.
   * Ignored with the SINGLE topology.
   *
   * @default - `docker/tm-php-fpm/Dockerfile` (APACHE_PHP_FPM) or
   * `docker/php-fpm/Dockerfile` (NGINX_PHP_FPM)
   */
  readonly phpFpmDockerfile?: string;

  /**
   * Task CPU units. With two containers, the web container gets a quarter.
   *
   * @default 1024
   */
  readonly cpu?: number;

  /**
   * Task memory in MiB. With two containers, the web container gets a fifth.
   *
   * @default 2048
   */
  readonly memoryLimitMiB?: number;

  /**
   * Number of tasks when the service is created.
   *
   * @default 2
   */
  readonly desiredCount?: number;

  /**
   * Autoscaling lower bound.
   *
   * @default 1
   */
  readonly minTaskCount?: number;

  /**
   * Autoscaling upper bound.
   *
   * @default 30
   */
  readonly maxTaskCount?: number;

  /**
   * Target CPU utilization of the autoscaling policy.
   *
   * @default 30
   */
  readonly targetCpuUtilizationPercent?: number;

  /**
   * Target memory utilization of the autoscaling policy.
   *
   * @default 30
   */
  readonly targetMemoryUtilizationPercent?: number;

  /**
   * Application name used in the secrets path `/applications/<name>/secrets/`.
   *
   * @default 'tm'
   */
  readonly applicationName?: string;

  /**
   * Hand-made SecureString parameters passed to the containers, by variable
   * name. Each is read from `/applications/<applicationName>/secrets/<NAME>`.
   *
   * @default []
   */
  readonly secretsFromSsmParameterStore?: string[];

  /**
   * Other SSM parameters passed to the containers, as `{ VARIABLE: parameterName }`.
   *
   * @default {}
   */
  readonly additionalSecretsFromParameterStore?: { [variable: string]: string };

  /**
   * Variables read from Secrets Manager secret fields, as
   * `{ VARIABLE: { secretArnParameterName, field } }`. Several variables can
   * point at the same `secretArnParameterName` to read different JSON fields of
   * a single secret, so one Secrets Manager secret can hold every application
   * secret at once.
   *
   * `secretArnParameterName` is an SSM `String` parameter holding the secret's
   * complete ARN (with the 6-character suffix). The containers read the fields
   * directly from Secrets Manager.
   *
   * @default {}
   */
  readonly secretsFromSecretsManager?: { [variable: string]: TmSecretField };

  /**
   * Variables whose value CDK generates once and stores in Secrets Manager,
   * never in the template nor in this file. One secret is created per name, and
   * its ARN is published to SSM at
   * `/applications/<applicationName>/generated/<NAME>-arn`. Use it for machine
   * values no human sets (e.g. a TYPO3 encryption key or install-tool
   * password).
   *
   * @default []
   */
  readonly generatedSecrets?: string[];

  /**
   * Plain environment variables passed to the containers.
   *
   * @default {}
   */
  readonly environment?: { [variable: string]: string };

  /**
   * Passes the values produced by the other stacks of the stage to the
   * containers: database and Redis endpoints, and the `TM_S3ASSETS_*`
   * variables when FAL is on S3.
   *
   * @default true
   */
  readonly wireStageOutputs?: boolean;

  /**
   * Passes the tm_cloudfront variables to the containers:
   * `TM_CLOUDFRONT_DISTRIBUTION_IDS`, `TM_CLOUDFRONT_APIKEY` and
   * `TM_CLOUDFRONT_APISECRET`.
   *
   * These values are produced by stacks that deploy after the ECS stack (the
   * distributions need the load balancer), so ECS reads them by name without a
   * stack dependency. Turn this on only once the CloudFront stacks have been
   * deployed: on a first deploy, the tasks can't start and the ECS stack fails.
   *
   * @default false
   */
  readonly cloudfrontIntegration?: boolean;

  /**
   * Command of the scheduled task (every minute).
   *
   * @default '/usr/local/bin/run-scheduler.sh'
   */
  readonly scheduledTasksCommand?: string;

  /**
   * Command run in a one-off task after each deployment.
   *
   * @default ['/usr/local/bin/deployment-hook.sh']
   */
  readonly deploymentHookCommand?: string[];
}

/**
 * TYPO3 FAL storage settings.
 */
export interface FalSettings {
  /**
   * FAL backend. Never change it on a deployed environment.
   */
  readonly storage: FalStorage;

  /**
   * With `FalStorage.EFS`, the FAL directories stored on EFS, relative to the
   * document root, e.g. `['fileadmin', 'uploads']`.
   *
   * @default ['fileadmin']
   */
  readonly efsDirectories?: string[];
}

/**
 * www distributions (one per domain).
 */
export interface CloudfrontSettings {
  /**
   * Domains served by the application. Each one gets its own distribution and
   * certificate. Distributions are identified by position: add new domains at
   * the end, and rename a domain in place rather than reordering the list.
   */
  readonly domains: string[];

  /**
   * Extra aliases of a distribution, keyed by an entry of `domains`. Only for
   * the punycode/homograph case where two names must share one distribution.
   *
   * @default {}
   */
  readonly additionalDomains?: { [domain: string]: string[] };

  /**
   * ACM certificate ARNs (us-east-1), keyed by an entry of `domains`.
   *
   * @default - read from the SSM parameter `TmParameterNames.cloudfrontWwwCertificateArn`
   */
  readonly certificateArns?: { [domain: string]: string };

  /**
   * Creates each distribution's ACM certificate (us-east-1) with manual DNS
   * validation, instead of requiring a pre-made certificate ARN. The created
   * ARN is published to the same SSM parameter the distribution reads, so the
   * import-by-ARN path (`certificateArns` or the hand-seeded parameter) and the
   * created path converge. The validation CNAME must exist in the DNS provider
   * (Cloudflare) once; the stage creates the certificates in a us-east-1 stack.
   *
   * @default false
   */
  readonly createCertificate?: boolean;

  /**
   * Generates the CloudFront origin custom-header value instead of requiring a
   * pre-seeded SSM parameter. CDK derives a stable, concrete value and the ECS
   * stack publishes it to the shared parameter both stacks read, so the ALB and
   * CloudFront always agree and no human seeds it.
   *
   * @default false
   */
  readonly generateOriginCustomHeader?: boolean;

  /**
   * Protects the site with HTTP basic authentication.
   *
   * @default false
   */
  readonly basicAuth?: boolean;

  /**
   * SSM parameter holding the base64 `user:password` for basic authentication.
   *
   * @default TmParameterNames.cloudfrontBasicAuth
   */
  readonly basicAuthParameterName?: string;

  /**
   * SSM parameter holding the secret header value CloudFront sends to the load
   * balancer. The load balancer rejects requests without it.
   *
   * @default TmParameterNames.cloudfrontOriginCustomHeader
   */
  readonly originCustomHeaderParameterName?: string;

  /**
   * Name of the distribution-ID parameter read by tm_cloudfront and by the
   * pipeline invalidation step.
   *
   * @default TmParameterNames.cloudfrontDistributionIds
   */
  readonly distributionIdsParameterName?: string;

  /**
   * Value format of the distribution-ID parameter. Follows the project's
   * tm_cloudfront version.
   *
   * @default DistributionIdsFormat.JSON_MAP
   */
  readonly distributionIdsFormat?: DistributionIdsFormat;

  /**
   * Writes CloudFront access logs to the log bucket.
   *
   * @default true
   */
  readonly accessLogs?: boolean;
}

/**
 * CDN distribution, serving the FAL content bucket.
 */
export interface CdnSettings {
  /**
   * Domain of the CDN distribution, e.g. `cdn.example.com`.
   */
  readonly domain: string;

  /**
   * ACM certificate ARN (us-east-1).
   *
   * @default - read from the SSM parameter `TmParameterNames.cloudfrontCdnCertificateArn`
   */
  readonly certificateArn?: string;

  /**
   * Creates the CDN distribution's ACM certificate (us-east-1) with manual DNS
   * validation, instead of requiring a pre-made certificate ARN. The created
   * ARN is published to the same SSM parameter the distribution reads. The
   * validation CNAME must exist in the DNS provider (Cloudflare) once; the
   * stage creates the certificate in a us-east-1 stack.
   *
   * @default false
   */
  readonly createCertificate?: boolean;
}

/**
 * Baseline WebACL associated with the distributions. It is created in
 * us-east-1, as CloudFront requires.
 */
export interface WafSettings {
  /**
   * Maximum requests per client IP in any 5-minute window. Above it, requests
   * are blocked.
   *
   * @default 2000
   */
  readonly rateLimit?: number;

  /**
   * Country codes (ISO 3166-1 alpha-2) whose requests are blocked.
   *
   * @default []
   */
  readonly blockedCountryCodes?: string[];

  /**
   * Associates the WebACL with the CDN distribution too.
   *
   * @default true
   */
  readonly protectCdn?: boolean;

  /**
   * Sends WebACL logs to CloudWatch Logs (30-day retention).
   *
   * @default true
   */
  readonly logging?: boolean;
}

/**
 * EC2 instance with an Elastic IP that redirects domains (e.g. the apex
 * domain to `www`). The redirection itself is configured on the instance.
 */
export interface RedirectionsSettings {
  /**
   * EC2 instance type.
   *
   * @default 't3a.micro'
   */
  readonly instanceType?: string;

  /**
   * Root volume size in GiB.
   *
   * @default 20
   */
  readonly ebsVolumeSize?: number;

  /**
   * AMI of the instance, pinned so it never changes by itself (a new AMI
   * replaces the instance).
   *
   * @default - the latest Amazon Linux 2023 AMI, looked up once and cached in `cdk.context.json`
   */
  readonly amiId?: string;
}

/**
 * AWS Backup settings.
 */
export interface BackupSettings {
  /**
   * Retention of the EBS volume backups, in days.
   *
   * @default 7
   */
  readonly ec2RetentionDays?: number;

  /**
   * Retention of the RDS cluster backups, in days.
   *
   * @default 35
   */
  readonly rdsRetentionDays?: number;
}

/**
 * CodePipeline settings.
 */
export interface PipelineSettings {
  /**
   * CodeCommit repository holding the infrastructure code.
   *
   * @default 'infrastructure'
   */
  readonly infrastructureRepositoryName?: string;

  /**
   * CodeCommit repository holding the application, cloned into the build context.
   *
   * @default 'application'
   */
  readonly applicationRepositoryName?: string;

  /**
   * SSM parameter holding the branch both repositories are deployed from.
   *
   * Only read for the CodeCommit source.
   *
   * @default '/pipeline/parameters/branchName'
   */
  readonly branchNameParameterName?: string;

  /**
   * Where the pipeline reads its source from.
   *
   * `CODECOMMIT` keeps the original behaviour: the infrastructure and
   * application CodeCommit repositories, on the branch read from
   * `branchNameParameterName`.
   *
   * `S3` instead creates two versioned S3 buckets (one for the infrastructure
   * source, one for the application), an IAM role GitHub Actions assumes over
   * OIDC to upload `source.zip` into them, and EventBridge rules that start the
   * pipeline on every upload. The remaining `S3`-only fields configure the OIDC
   * trust. The OIDC provider itself must already exist in the account.
   *
   * @default PipelineSourceType.CODECOMMIT
   */
  readonly sourceType?: PipelineSourceType;

  /**
   * `S3` source only: GitHub `owner/repo` of the infrastructure repository,
   * used in the OIDC trust subject so only its CI can upload the infrastructure
   * source. Required when `sourceType` is `S3`.
   *
   * @default - required for the S3 source
   */
  readonly infrastructureGithubRepo?: string;

  /**
   * `S3` source only: GitHub `owner/repo` of the application repository, used in
   * the OIDC trust subject so only its CI can upload the application source.
   * Required when `sourceType` is `S3`.
   *
   * @default - required for the S3 source
   */
  readonly applicationGithubRepo?: string;

  /**
   * `S3` source only: the git branch CI uploads from, allowed to assume the
   * OIDC upload role (`refs/heads/<sourceBranch>` in the trust subject).
   *
   * Only read when `sourceEnvironment` is unset: a workflow job scoped to a
   * GitHub Environment mints an `environment:<name>` subject, not a branch one.
   *
   * @default 'prod'
   */
  readonly sourceBranch?: string;

  /**
   * `S3` source only: the name of the GitHub Environment whose OIDC token may
   * assume the upload role. When set, the trust subject matches
   * `repo:<owner/repo>:environment:<name>` for both repositories instead of the
   * branch form `repo:<owner/repo>:ref:refs/heads/<sourceBranch>`.
   *
   * A GitHub Actions job that declares `environment: <name>` mints an OIDC
   * token whose `sub` claim is `repo:<owner/repo>:environment:<name>`, so this
   * must be set (and match the GitHub Environment name) whenever the upload
   * workflow runs under an environment — otherwise AssumeRole is denied. Set it
   * to put the GitHub variables inside that environment rather than at the
   * repository scope.
   *
   * @default - unset; the trust uses the branch form with `sourceBranch`
   */
  readonly sourceEnvironment?: string;
}

/**
 * Everything specific to one environment (one AWS account) of a web
 * application.
 */
export interface EnvironmentParameters {
  /**
   * AWS account ID.
   */
  readonly account: string;

  /**
   * Region of the application.
   *
   * @default 'ca-central-1'
   */
  readonly region?: string;

  /**
   * Environment segment of the SSM parameter names, e.g. `prod`.
   */
  readonly environmentName: string;

  /**
   * Network settings.
   */
  readonly vpc: VpcSettings;

  /**
   * Bastion host settings.
   *
   * @default - defaults of `BastionSettings`
   */
  readonly bastion?: BastionSettings;

  /**
   * Aurora MySQL settings.
   *
   * @default - defaults of `RdsSettings`
   */
  readonly rds?: RdsSettings;

  /**
   * Redis settings.
   *
   * @default - defaults of `RedisSettings`
   */
  readonly redis?: RedisSettings;

  /**
   * Apache Solr search instance. Opt-in: without this field, no Solr stack is
   * created.
   *
   * @default - no Solr instance
   */
  readonly solr?: SolrSettings;

  /**
   * ECS service settings.
   */
  readonly ecs: EcsSettings;

  /**
   * TYPO3 FAL storage. With `FalStorage.S3`, the stage creates the content
   * bucket.
   */
  readonly fal: FalSettings;

  /**
   * Service users to create, with their access keys in Secrets Manager.
   *
   * @default []
   */
  readonly serviceIamUsers?: ServiceIamUser[];

  /**
   * www distributions.
   *
   * @default - no www distribution
   */
  readonly cloudfront?: CloudfrontSettings;

  /**
   * CDN distribution for the FAL content bucket. Requires `FalStorage.S3`.
   *
   * @default - no CDN distribution
   */
  readonly cdn?: CdnSettings;

  /**
   * Baseline WebACL for the distributions.
   *
   * @default - no WebACL
   */
  readonly waf?: WafSettings;

  /**
   * Redirection instance.
   *
   * @default - no redirection instance
   */
  readonly redirections?: RedirectionsSettings;

  /**
   * AWS Backup settings.
   *
   * @default - defaults of `BackupSettings`
   */
  readonly backup?: BackupSettings;

  /**
   * CodePipeline settings.
   *
   * @default - defaults of `PipelineSettings`
   */
  readonly pipeline?: PipelineSettings;
}

/**
 * Selects the environment parameters of the current account.
 */
export class TmEnvironmentParameters {
  /**
   * Returns the entry whose `account` matches.
   *
   * @param parameters one entry per AWS account
   * @param account the account to select
   * @default account process.env.CDK_DEFAULT_ACCOUNT
   */
  public static select(parameters: EnvironmentParameters[], account?: string): EnvironmentParameters {
    const target = account ?? process.env.CDK_DEFAULT_ACCOUNT;
    const found = parameters.find(p => p.account === target);
    if (!found) {
      const valid = parameters.map(p => `${p.account} (${p.environmentName})`).join(', ');
      throw new Error(`No environment parameters for account '${target}'. Valid accounts: ${valid}.`);
    }
    return found;
  }
}
