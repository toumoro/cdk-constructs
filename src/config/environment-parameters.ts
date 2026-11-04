import { Duration } from 'aws-cdk-lib';
import { HeadersFrameOption, HeadersReferrerPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { BackupResourceType, ContainerTopology, DistributionIdsFormat, FalS3Driver, FalStorage, PipelineSourceType, ServiceIamUser } from './enums';
import { TmBackupRule } from '../stacks/backup/tm-backup-stack';
import { TmSecretField } from '../stacks/compute/tm-ecs-stack';
import { WafIpRestrictedPath } from '../stacks/security/tm-waf-stack';

export { TmBackupRule } from '../stacks/backup/tm-backup-stack';

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
 * Database bootstrap settings (opt-in).
 */
export interface RdsBootstrapSettings {
  /**
   * Enables the bootstrap: a VPC Lambda creates the application database and
   * user, sets the user's password from the CDK-generated secret, and imports
   * the dump (`db/latest.sql`) from the bootstrap-assets bucket. Idempotent,
   * and a no-op on stack delete (data retained). Off by default, so other
   * consumers are untouched.
   *
   * The dump is REQUIRED when enabled: a greenfield TYPO3 against an empty
   * schema fails every request and the ALB health check never passes, so a
   * missing dump makes the Lambda fail fast with a clear message rather than a
   * ten-minute health-check timeout.
   */
  readonly enabled: boolean;

  /**
   * Key of the dump object in the bootstrap-assets bucket.
   *
   * @default 'db/latest.sql'
   */
  readonly dumpKey?: string;
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

  /**
   * Database bootstrap. Opt-in: without it (default) nothing is created, so
   * consumers that don't need it (e.g. JARO) are untouched.
   *
   * @default - no bootstrap
   */
  readonly bootstrap?: RdsBootstrapSettings;
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

  /**
   * Cache engine, `redis` or `valkey`. ElastiCache upgrades a Redis OSS
   * replication group to Valkey in place.
   *
   * @default 'redis'
   */
  readonly engine?: string;

  /**
   * Engine version, e.g. `7.1` for Redis OSS or `9.1` for Valkey. With
   * `valkey`, a parameter group of the matching family (`valkey9`) is created.
   *
   * @default '7.1'
   */
  readonly engineVersion?: string;
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
 * Health check of the load balancer target group(s).
 */
export interface EcsHealthCheckSettings {
  /**
   * Request path.
   *
   * @default '/'
   */
  readonly path?: string;

  /**
   * HTTP codes counted as healthy, e.g. `200`, `200,301` or `200-499`.
   *
   * @default '200'
   */
  readonly healthyHttpCodes?: string;

  /**
   * Seconds between two checks of a target.
   *
   * @default 30
   */
  readonly intervalSeconds?: number;

  /**
   * Seconds without a response before a check fails.
   *
   * @default 5
   */
  readonly timeoutSeconds?: number;

  /**
   * Consecutive successes before a target is healthy.
   *
   * @default 5
   */
  readonly healthyThresholdCount?: number;

  /**
   * Consecutive failures before a target is unhealthy.
   *
   * @default 2
   */
  readonly unhealthyThresholdCount?: number;
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
   * Docker build target stage of the `web` container. Set it to build a
   * specific stage of the Dockerfile (new stages can be added later).
   *
   * @default - the Dockerfile's last stage
   */
  readonly webBuildTarget?: string;

  /**
   * Docker build target stage of the `php-fpm` container. Ignored with the
   * SINGLE topology.
   *
   * @default - the Dockerfile's last stage
   */
  readonly phpFpmBuildTarget?: string;

  /**
   * Prepends a `chown` of the EFS `typo3temp/assets` mount (to uid/gid 33,
   * www-data) to the post-deploy hook command. ECS creates the mount's
   * intermediate directories as root, so www-data cannot write under them;
   * this fixes the ownership once per deploy (idempotent). Off by default so
   * the deployment-hook command of existing environments is unchanged.
   *
   * @default false
   */
  readonly fixEfsAssetsOwnership?: boolean;

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
   * Drops the memory target-tracking policy and scales on CPU only. A PHP-FPM
   * task's memory utilization barely depends on the load, so a memory target
   * either never triggers or scales out to `maxTaskCount` and stays there.
   *
   * @default false - both policies, as before
   */
  readonly disableMemoryScaling?: boolean;

  /**
   * Runs the tasks (service, deployment hook) in the private subnets with
   * egress, without a public IP: only the load balancer is reachable. Turning
   * it on is a rolling update of the service (no downtime).
   *
   * @default false - public subnets with a public IP, as before
   */
  readonly tasksInPrivateSubnets?: boolean;

  /**
   * Health check of the load balancer target group (and of the VPC origin
   * bridge's, when present). Only the fields set here change; a target group
   * without this setting keeps the ELB defaults as before.
   *
   * @default - ELB defaults (path `/`, code 200)
   */
  readonly healthCheck?: EcsHealthCheckSettings;

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
   * containers: database and Redis endpoints, and the S3 FAL variables
   * (`FalSettings.s3Driver`) when FAL is on S3.
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

  /**
   * With `FalStorage.S3`, the TYPO3 extension reading the content bucket. It
   * selects the variable names passed to the containers (see `FalS3Driver`).
   *
   * @default FalS3Driver.TM_S3ASSETS
   */
  readonly s3Driver?: FalS3Driver;
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
   * Connects the distributions to the load balancer through a CloudFront VPC
   * origin over HTTPS (port 443) instead of a public load balancer over HTTP.
   *
   * When true, the ECS stack creates an INTERNAL load balancer in the private
   * subnets, with an HTTPS listener and an ACM certificate (DNS validation,
   * same CNAME as the us-east-1 certificate of the same domain) covering the
   * www domains, publishes its ARN in SSM, and the CloudFront stack reaches it
   * through a VPC origin: the load balancer has no public address at all. The
   * secret origin header is still required by the listener.
   *
   * A load balancer cannot change scheme in place: on a deployed environment,
   * flipping this alone REPLACES it and CloudFront only follows at the next
   * stack, hence an outage. Use `vpcOriginBridge` for the no-downtime path.
   *
   * @default false - public load balancer, HTTP origin on port 80
   */
  readonly vpcOrigin?: boolean;

  /**
   * Adds a second, INTERNAL HTTPS load balancer ("bridge") to the same
   * service, and makes it the VPC origin endpoint while `vpcOrigin` is false.
   * It is the no-downtime migration path from the public load balancer, in
   * three pipeline runs, each one keeping a serving load balancer throughout:
   *
   * 1. `vpcOriginBridge: true` (`vpcOrigin` false): the bridge is created and
   *    CloudFront switches to a VPC origin on it; the public load balancer
   *    keeps serving until CloudFront's new configuration is live. Combine
   *    with `ecs.tasksInPrivateSubnets: true` (rolling update).
   * 2. `vpcOrigin: true`, `vpcOriginBridge: true`: the service's own load
   *    balancer is replaced by an internal one and CloudFront repoints to it,
   *    while the bridge carries the traffic.
   * 3. `vpcOrigin: true` alone: the bridge is removed.
   *
   * @default false
   */
  readonly vpcOriginBridge?: boolean;

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
   * Serves the FAL content bucket under this path of the www distributions
   * (e.g. `/fileadmin`), instead of a separate `cdn` distribution: same URLs
   * as `public/fileadmin` and same host as the site. The path is removed
   * before the request reaches the bucket (keys have no prefix), and the
   * responses carry a strict Content-Security-Policy (see
   * `falContentSecurityPolicy`) and `X-Content-Type-Options: nosniff`. The
   * FAL public base URL
   * becomes `<first domain><falPath>`. Requires `fal.storage`
   * `FalStorage.S3`; exclusive with `cdn`.
   *
   * @default - the bucket is not served by the www distributions
   */
  readonly falPath?: string;

  /**
   * Content-Security-Policy of every file under `falPath`, PDFs included. It
   * applies when a file is opened as a document (directly or in a frame), not
   * when a page embeds it as an image or a video. The default loads nothing
   * but same-origin images and media (an image or a video opened directly)
   * and inline styles (SVG); no script, form or plugin, and sandboxed.
   *
   * @default "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox"
   */
  readonly falContentSecurityPolicy?: string;

  /**
   * Writes CloudFront access logs to the log bucket.
   *
   * @default true
   */
  readonly accessLogs?: boolean;

  /**
   * Response headers policy on every behavior of the www distributions: CORS
   * for the distribution's own domains (`https://<domain>` and its
   * `additionalDomains`) plus `additionalCorsOrigins`, HSTS,
   * `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and
   * `Permissions-Policy`; removes `Server` and `X-Powered-By`. Each one is set
   * in `ResponseHeadersSettings`. No Content-Security-Policy, which the
   * application sets, except on `falPath` (its own policy, a copy of this one
   * with `falContentSecurityPolicy`).
   *
   * @default - no response headers policy
   */
  readonly responseHeaders?: ResponseHeadersSettings;
}

/**
 * Response headers of the www distributions.
 */
export interface ResponseHeadersSettings {
  /**
   * CORS origins allowed besides the distribution's own domains, with their
   * scheme (e.g. `https://www.example.com`).
   *
   * @default []
   */
  readonly additionalCorsOrigins?: string[];

  /**
   * Value of the `Permissions-Policy` header.
   *
   * @default 'accelerometer=(), camera=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), geolocation=()'
   */
  readonly permissionsPolicy?: string;

  /**
   * `Strict-Transport-Security` header.
   *
   * @default - one year, includeSubDomains and preload
   */
  readonly strictTransportSecurity?: StrictTransportSecuritySettings;

  /**
   * Sets `X-Content-Type-Options: nosniff`.
   *
   * @default true
   */
  readonly contentTypeOptions?: boolean;

  /**
   * Value of the `X-Frame-Options` header.
   *
   * @default HeadersFrameOption.SAMEORIGIN
   */
  readonly frameOption?: HeadersFrameOption;

  /**
   * Value of the `Referrer-Policy` header.
   *
   * @default HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN
   */
  readonly referrerPolicy?: HeadersReferrerPolicy;

  /**
   * Headers removed from the responses of the origin.
   *
   * @default ['Server', 'X-Powered-By']
   */
  readonly removeHeaders?: string[];
}

/**
 * `Strict-Transport-Security` header of the www distributions.
 */
export interface StrictTransportSecuritySettings {
  /**
   * `max-age` of the header.
   *
   * @default Duration.days(365)
   */
  readonly maxAge?: Duration;

  /**
   * Adds `includeSubDomains`.
   *
   * @default true
   */
  readonly includeSubdomains?: boolean;

  /**
   * Adds `preload`. It registers nothing by itself: submitting the domain to
   * hstspreload.org requires the header on the apex domain and binds all of
   * its subdomains.
   *
   * @default true
   */
  readonly preload?: boolean;
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
   * Paths reachable only from the given IP ranges (at most 4), e.g. the TYPO3
   * backend `/typo3/` limited to the client's offices. Other IPs are blocked
   * before any other rule.
   *
   * @default []
   */
  readonly ipRestrictedPaths?: WafIpRestrictedPath[];

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
   * Retention of the EBS volume backups, in days. Ignored when `rules` is set.
   *
   * @default 7
   */
  readonly ec2RetentionDays?: number;

  /**
   * Retention of the RDS cluster backups, in days. Ignored when `rules` is set.
   *
   * @default 35
   */
  readonly rdsRetentionDays?: number;

  /**
   * Rules of a single plan backing up `resources`, in place of the daily EBS
   * and RDS plans (e.g. daily kept 30 days and monthly kept 365 days). The
   * vault is kept, with its recovery points.
   *
   * @default - daily EBS and RDS plans, see `ec2RetentionDays` and `rdsRetentionDays`
   */
  readonly rules?: TmBackupRule[];

  /**
   * Resources backed up by `rules`.
   *
   * @default [BackupResourceType.EBS_VOLUMES, BackupResourceType.RDS_CLUSTERS]
   */
  readonly resources?: BackupResourceType[];

  /**
   * EFS automatic backups (the AWS default plan, daily, kept 35 days). Turn
   * off when `resources` includes `BackupResourceType.EFS`, so EFS is not
   * backed up twice.
   *
   * @default true
   */
  readonly efsAutomaticBackups?: boolean;
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
   * Runs the synth with the repository's own CDK CLI (`npx cdk`, the
   * `aws-cdk` devDependency installed by `npm ci`) instead of a global
   * `npm install -g aws-cdk` of whatever version is current that day. The
   * repository must list `aws-cdk` in its devDependencies.
   *
   * @default false - global install, as before
   */
  readonly useRepositoryCdkCli?: boolean;

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

  /**
   * `S3` source only: the GitHub organization's numeric ID. Set this together
   * with `infrastructureGithubRepoId` and `applicationGithubRepoId` when a
   * repository has "Use repository and organization IDs in the OIDC subject
   * claim" enabled. GitHub then mints an immutable-ID subject
   * `repo:<owner>@<orgId>/<repo>@<repoId>:environment:<name>` instead of the
   * name-based `repo:<owner/repo>:...`.
   *
   * This setting is per-REPOSITORY, so the two source repos may mint different
   * forms. When the IDs are set the trust policy trusts BOTH the name-based and
   * the ID-based subject for every repo, so it is correct whichever form each
   * repo produces and keeps working if the setting is toggled later. All three
   * ID fields must be set together; if any is missing only the name-based
   * subject is trusted.
   *
   * @default - unset; only the name-based subject is trusted
   */
  readonly githubOrgId?: string;

  /**
   * `S3` source only: numeric repository ID of the infrastructure repository.
   * Used with `githubOrgId` to also trust the immutable-ID OIDC trust subject.
   * See `githubOrgId`.
   *
   * @default - unset; only the name-based subject is trusted
   */
  readonly infrastructureGithubRepoId?: string;

  /**
   * `S3` source only: numeric repository ID of the application repository. Used
   * with `githubOrgId` to also trust the immutable-ID OIDC trust subject. See
   * `githubOrgId`.
   *
   * @default - unset; only the name-based subject is trusted
   */
  readonly applicationGithubRepoId?: string;
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
