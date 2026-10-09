import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ContainerTopology, DistributionIdsFormat, FalStorage, ServiceIamUser } from '../config/enums';
import { EnvironmentParameters } from '../config/environment-parameters';
import { TmParameterNames } from '../config/parameter-names';
import { TmBackupStack } from '../stacks/backup/tm-backup-stack';
import { TmDistributionIdsOptions } from '../stacks/cdn/distribution-ids-parameter';
import { TmCertificateRequest, TmCertificateStack } from '../stacks/cdn/tm-certificate-stack';
import { TmCloudfrontCdnStack } from '../stacks/cdn/tm-cloudfront-cdn-stack';
import { TmCloudfrontStack } from '../stacks/cdn/tm-cloudfront-stack';
import { TmBastionStack } from '../stacks/compute/tm-bastion-stack';
import { TmEcsStack, TmSecretField } from '../stacks/compute/tm-ecs-stack';
import { TmRedirectionsEc2Stack } from '../stacks/compute/tm-redirections-ec2-stack';
import { TmRdsAuroraMysqlServerlessStack } from '../stacks/data/tm-rds-aurora-mysql-serverless-stack';
import { TmRedisStack } from '../stacks/data/tm-redis-stack';
import { TmServiceIamUsersStack } from '../stacks/iam/tm-service-iam-users-stack';
import { TmVpcBaseStack } from '../stacks/network/tm-vpc-base-stack';
import { TmSolrStack } from '../stacks/search/tm-solr-stack';
import { TmWafStack } from '../stacks/security/tm-waf-stack';
import { TmS3Stack } from '../stacks/storage/tm-s3-stack';

/**
 * Stack ids of the stage. They are part of the CloudFormation stack names and
 * logical IDs, so a deployed repository must keep its current ids.
 * `<Region>` is the PascalCase application region, e.g. `CaCentral1`.
 */
export interface TmWebappStackIds {
  /** @default 'TmVpc<Region>Stack' */
  readonly vpc?: string;
  /** @default 'TmBastion<Region>Stack' */
  readonly bastion?: string;
  /** @default 'TmRdsAurora<Region>' */
  readonly rds?: string;
  /** @default 'TmRedis<Region>Stack' */
  readonly redis?: string;
  /** @default 'TmSolr<Region>Stack' */
  readonly solr?: string;
  /** @default 'TmEcs<Region>Stack' */
  readonly ecs?: string;
  /** @default 'TmBackup<Region>Stack' */
  readonly backup?: string;
  /** @default 'TmS3<Region>Stack' */
  readonly s3?: string;
  /** @default 'TmServiceIamUsers<Region>Stack' */
  readonly serviceIamUsers?: string;
  /** @default 'TmWafUsEast1Stack' */
  readonly waf?: string;
  /** @default 'TmCertificateUsEast1Stack' */
  readonly certificate?: string;
  /** @default 'TmCloudfront<Region>Stack' */
  readonly cloudfront?: string;
  /** @default 'TmCloudfrontCdn<Region>Stack' */
  readonly cdn?: string;
  /** @default 'TmRedirectionsEc2<Region>Stack' */
  readonly redirections?: string;
}

/**
 * Props for `TmWebappAppStage`.
 */
export interface TmWebappAppStageProps extends cdk.StageProps {
  /**
   * Settings of the environment.
   */
  readonly parameters: EnvironmentParameters;

  /**
   * Docker build context: the application repository checkout.
   */
  readonly buildContextPath: string;

  /**
   * Docker build context of the Solr image, usually the application's
   * `docker/solr` directory. Required when `parameters.solr` is set.
   *
   * @default - `<buildContextPath>/docker/solr`
   */
  readonly solrBuildContextPath?: string;

  /**
   * Local directory of error pages (`<code>.html`) served by the www
   * distributions for 4xx and 5xx responses.
   *
   * @default - CloudFront's default error responses
   */
  readonly errorPagesPath?: string;

  /**
   * Stack ids.
   *
   * @default - see `TmWebappStackIds`
   */
  readonly stackIds?: TmWebappStackIds;
}

/**
 * The TYPO3 web application: VPC, bastion, Aurora MySQL, Redis, ECS, backups,
 * and optionally S3, service users, WebACL, www and CDN distributions and a
 * redirection instance, all driven by `EnvironmentParameters`.
 *
 * Stacks only reference each other through SSM parameters
 * (`TmParameterNames`), so no stack is locked by another's exports. The deploy
 * order is declared with explicit dependencies.
 *
 * The stacks are exposed so a repository can add its own stacks to the stage.
 */
export class TmWebappAppStage extends cdk.Stage {
  /** VPC stack. */
  public readonly vpcStack: TmVpcBaseStack;
  /** Bastion stack. */
  public readonly bastionStack: TmBastionStack;
  /** Aurora MySQL stack. */
  public readonly rdsStack: TmRdsAuroraMysqlServerlessStack;
  /** Redis stack. */
  public readonly redisStack: TmRedisStack;
  /** Solr stack, when `solr` is set. */
  public readonly solrStack?: TmSolrStack;
  /** ECS stack. */
  public readonly ecsStack: TmEcsStack;
  /** Backup stack. */
  public readonly backupStack: TmBackupStack;
  /** S3 stack, when a bucket is needed. */
  public readonly s3Stack?: TmS3Stack;
  /** Service users stack, when `serviceIamUsers` is not empty. */
  public readonly serviceIamUsersStack?: TmServiceIamUsersStack;
  /** WebACL stack (us-east-1), when `waf` is set. */
  public readonly wafStack?: TmWafStack;
  /** Certificate stack (us-east-1), when a distribution opts into `createCertificate`. */
  public readonly certificateStack?: TmCertificateStack;
  /** www distributions stack, when `cloudfront` is set. */
  public readonly cloudfrontStack?: TmCloudfrontStack;
  /** CDN distribution stack, when `cdn` is set. */
  public readonly cdnStack?: TmCloudfrontCdnStack;
  /** Redirection instance stack, when `redirections` is set. */
  public readonly redirectionsStack?: TmRedirectionsEc2Stack;

  constructor(scope: Construct, id: string, props: TmWebappAppStageProps) {
    super(scope, id, props);

    const params = props.parameters;
    const environmentName = params.environmentName;
    const region = params.region ?? 'ca-central-1';
    const regionName = toPascalCase(region);
    const env = { account: params.account, region };
    const ids = props.stackIds ?? {};
    const vpcCidr = params.vpc.cidr;
    const serviceUsers = params.serviceIamUsers ?? [];
    const falOnS3 = params.fal.storage === FalStorage.S3;
    const accessLogs = params.cloudfront !== undefined && (params.cloudfront.accessLogs ?? true);

    if (params.cdn && !falOnS3) {
      throw new Error('cdn serves the FAL content bucket: it requires fal.storage FalStorage.S3.');
    }
    if (serviceUsers.includes(ServiceIamUser.S3) && !falOnS3) {
      throw new Error('The S3 service user needs the FAL content bucket: it requires fal.storage FalStorage.S3.');
    }

    this.vpcStack = new TmVpcBaseStack(this, ids.vpc ?? `TmVpc${regionName}Stack`, {
      env,
      environmentName,
      cidr: vpcCidr,
      hostedZoneName: params.vpc.hostedZoneName,
    });

    this.bastionStack = new TmBastionStack(this, ids.bastion ?? `TmBastion${regionName}Stack`, {
      env,
      environmentName,
      vpcCidr,
      instanceType: params.bastion?.instanceType,
    });
    this.bastionStack.addStackDependency(this.vpcStack);

    this.rdsStack = new TmRdsAuroraMysqlServerlessStack(this, ids.rds ?? `TmRdsAurora${regionName}`, {
      env,
      environmentName,
      vpcCidr,
      instanceType: params.rds?.instanceType,
      performanceInsights: params.rds?.performanceInsights,
      bootstrap: this.rdsBootstrap(params),
    });
    this.rdsStack.addStackDependency(this.bastionStack);

    this.redisStack = new TmRedisStack(this, ids.redis ?? `TmRedis${regionName}Stack`, {
      env,
      environmentName,
      vpcCidr,
      cacheNodeType: params.redis?.cacheNodeType,
      replicasPerNodeGroup: params.redis?.replicasPerNodeGroup,
    });
    this.redisStack.addStackDependency(this.bastionStack);

    if (params.solr) {
      const solrBuildContextPath = props.solrBuildContextPath ?? path.join(props.buildContextPath, 'docker/solr');
      this.solrStack = new TmSolrStack(this, ids.solr ?? `TmSolr${regionName}Stack`, {
        env,
        environmentName,
        vpcCidr,
        hostedZoneName: params.vpc.hostedZoneName,
        buildContextPath: solrBuildContextPath,
        instanceType: params.solr.instanceType,
        ebsVolumeSize: params.solr.ebsVolumeSize,
        solrJavaMem: params.solr.solrJavaMem,
        solrOpts: params.solr.solrOpts,
        enabledCores: params.solr.enabledCores,
        recordName: params.solr.recordName,
      });
      this.solrStack.addStackDependency(this.vpcStack);
      this.solrStack.addStackDependency(this.bastionStack);
    }

    if (falOnS3 || accessLogs || props.errorPagesPath) {
      this.s3Stack = new TmS3Stack(this, ids.s3 ?? `TmS3${regionName}Stack`, {
        env,
        environmentName,
        contentBucket: falOnS3,
        logBucket: accessLogs,
        errorPagesPath: props.errorPagesPath,
      });
    }

    if (serviceUsers.length > 0) {
      this.serviceIamUsersStack = new TmServiceIamUsersStack(this, ids.serviceIamUsers ?? `TmServiceIamUsers${regionName}Stack`, {
        env,
        environmentName,
        users: serviceUsers,
      });
      if (this.s3Stack) {
        this.serviceIamUsersStack.addStackDependency(this.s3Stack);
      }
    }

    const distributionIds: TmDistributionIdsOptions = {
      parameterName: params.cloudfront?.distributionIdsParameterName ?? TmParameterNames.cloudfrontDistributionIds(environmentName),
      format: params.cloudfront?.distributionIdsFormat ?? DistributionIdsFormat.JSON_MAP,
    };

    this.ecsStack = new TmEcsStack(this, ids.ecs ?? `TmEcs${regionName}Stack`, {
      env,
      environmentName,
      vpcCidr,
      buildContextPath: props.buildContextPath,
      ...this.ecsImages(params),
      originCustomHeaderParameterName: params.cloudfront?.originCustomHeaderParameterName
        ?? TmParameterNames.cloudfrontOriginCustomHeader(environmentName),
      generateOriginCustomHeader: params.cloudfront?.generateOriginCustomHeader,
      applicationName: params.ecs.applicationName ?? 'tm',
      ...this.ecsVariables(params, region, distributionIds.parameterName),
      solrSecurityGroupIdParameterName: params.solr ? TmParameterNames.solrSecurityGroupId(environmentName) : undefined,
      falEfsDirectories: falOnS3 ? [] : (params.fal.efsDirectories ?? ['fileadmin']),
      cpu: params.ecs.cpu,
      memoryLimitMiB: params.ecs.memoryLimitMiB,
      desiredCount: params.ecs.desiredCount,
      minTaskCount: params.ecs.minTaskCount,
      maxTaskCount: params.ecs.maxTaskCount,
      targetCpuUtilizationPercent: params.ecs.targetCpuUtilizationPercent,
      targetMemoryUtilizationPercent: params.ecs.targetMemoryUtilizationPercent,
      scheduledTasksCommand: params.ecs.scheduledTasksCommand,
      deploymentHookCommand: params.ecs.deploymentHookCommand,
      fixEfsAssetsOwnership: params.ecs.fixEfsAssetsOwnership,
    });
    this.ecsStack.addStackDependency(this.rdsStack);
    this.ecsStack.addStackDependency(this.redisStack);
    if (this.solrStack) {
      this.ecsStack.addStackDependency(this.solrStack);
    }
    if (this.s3Stack) {
      this.ecsStack.addStackDependency(this.s3Stack);
    }
    if (this.serviceIamUsersStack) {
      this.ecsStack.addStackDependency(this.serviceIamUsersStack);
    }

    if (params.waf) {
      this.wafStack = new TmWafStack(this, ids.waf ?? 'TmWafUsEast1Stack', {
        env: { account: params.account, region: 'us-east-1' },
        environmentName,
        parameterRegion: region,
        rateLimit: params.waf.rateLimit,
        blockedCountryCodes: params.waf.blockedCountryCodes,
        logging: params.waf.logging,
      });
    }

    // ACM certificates for the distributions that opt into `createCertificate`.
    // Created in us-east-1 (CloudFront requires it) and their ARNs published to
    // the same SSM parameters (application region) the CloudFront stacks read,
    // so the created path and the import-by-ARN path converge.
    const certificateRequests: TmCertificateRequest[] = [];
    if (params.cloudfront?.createCertificate) {
      params.cloudfront.domains.forEach((domain, index) => {
        certificateRequests.push({
          domainName: domain,
          subjectAlternativeNames: params.cloudfront!.additionalDomains?.[domain],
          parameterName: TmParameterNames.cloudfrontWwwCertificateArn(environmentName, index),
          idInfix: index === 0 ? 'Www' : `Www${index + 1}`,
        });
      });
    }
    if (params.cdn?.createCertificate) {
      certificateRequests.push({
        domainName: params.cdn.domain,
        parameterName: TmParameterNames.cloudfrontCdnCertificateArn(environmentName),
        idInfix: 'Cdn',
      });
    }
    if (certificateRequests.length > 0) {
      this.certificateStack = new TmCertificateStack(this, ids.certificate ?? 'TmCertificateUsEast1Stack', {
        env: { account: params.account, region: 'us-east-1' },
        parameterRegion: region,
        certificates: certificateRequests,
      });
    }

    if (params.cloudfront) {
      const cloudfront = params.cloudfront;
      this.cloudfrontStack = new TmCloudfrontStack(this, ids.cloudfront ?? `TmCloudfront${regionName}Stack`, {
        env,
        environmentName,
        domains: cloudfront.domains,
        additionalDomains: cloudfront.additionalDomains,
        certificateArns: cloudfront.certificateArns,
        originCustomHeaderParameterName: cloudfront.originCustomHeaderParameterName
          ?? TmParameterNames.cloudfrontOriginCustomHeader(environmentName),
        basicAuth: cloudfront.basicAuth,
        basicAuthParameterName: cloudfront.basicAuthParameterName,
        webAcl: this.wafStack !== undefined,
        accessLogs,
        errorPages: props.errorPagesPath !== undefined,
        distributionIds: params.cdn ? undefined : distributionIds,
      });
      this.cloudfrontStack.addStackDependency(this.ecsStack);
      this.addOptionalDependencies(this.cloudfrontStack, this.s3Stack, this.wafStack, this.certificateStack);
    }

    if (params.cdn) {
      this.cdnStack = new TmCloudfrontCdnStack(this, ids.cdn ?? `TmCloudfrontCdn${regionName}Stack`, {
        env,
        environmentName,
        domain: params.cdn.domain,
        certificateArn: params.cdn.certificateArn,
        webAcl: this.wafStack !== undefined && (params.waf?.protectCdn ?? true),
        accessLogs,
        distributionIds,
        wwwDomains: (params.cloudfront?.domains ?? []).map(domain =>
          [domain, ...(params.cloudfront?.additionalDomains?.[domain] ?? [])]),
      });
      this.addOptionalDependencies(this.cdnStack, this.s3Stack, this.wafStack, this.cloudfrontStack, this.certificateStack);
    }

    if (params.redirections) {
      this.redirectionsStack = new TmRedirectionsEc2Stack(this, ids.redirections ?? `TmRedirectionsEc2${regionName}Stack`, {
        env,
        environmentName,
        vpcCidr,
        instanceType: params.redirections.instanceType,
        ebsVolumeSize: params.redirections.ebsVolumeSize,
        amiId: params.redirections.amiId,
      });
      this.redirectionsStack.addStackDependency(this.vpcStack);
    }

    this.backupStack = new TmBackupStack(this, ids.backup ?? `TmBackup${regionName}Stack`, {
      env,
      ec2RetentionDays: params.backup?.ec2RetentionDays,
      rdsRetentionDays: params.backup?.rdsRetentionDays,
    });
  }

  private addOptionalDependencies(stack: cdk.Stack, ...dependencies: (cdk.Stack | undefined)[]) {
    dependencies.forEach(dependency => dependency && stack.addStackDependency(dependency));
  }

  /**
   * Bootstrap settings for the RDS stack, derived from `rds.bootstrap` and the
   * database name/username read from `ecs.environment`. Returns undefined when
   * bootstrap is off (default), so the RDS stack creates nothing extra.
   */
  private rdsBootstrap(params: EnvironmentParameters) {
    if (!params.rds?.bootstrap?.enabled) {
      return undefined;
    }
    const applicationName = params.ecs.applicationName ?? 'tm';
    const databaseName = params.ecs.environment?.TM_DATABASE_NAME;
    const databaseUsername = params.ecs.environment?.TM_DATABASE_USERNAME;
    if (!databaseName || !databaseUsername) {
      throw new Error('rds.bootstrap requires ecs.environment.TM_DATABASE_NAME and ecs.environment.TM_DATABASE_USERNAME.');
    }
    return {
      enabled: true,
      dumpKey: params.rds.bootstrap.dumpKey,
      databaseName,
      databaseUsername,
      applicationName,
    };
  }

  private ecsImages(params: EnvironmentParameters) {
    const containerTopology = params.ecs.containerTopology ?? ContainerTopology.APACHE_PHP_FPM;
    const defaults = {
      [ContainerTopology.SINGLE]: { web: 'docker/php-apache/Dockerfile', fpm: undefined },
      [ContainerTopology.APACHE_PHP_FPM]: { web: 'docker/tm-apache/Dockerfile', fpm: 'docker/tm-php-fpm/Dockerfile' },
      [ContainerTopology.NGINX_PHP_FPM]: { web: 'docker/nginx/Dockerfile', fpm: 'docker/php-fpm/Dockerfile' },
    }[containerTopology];
    return {
      containerTopology,
      webDockerfile: params.ecs.webDockerfile ?? defaults.web,
      phpFpmDockerfile: containerTopology === ContainerTopology.SINGLE ? undefined : (params.ecs.phpFpmDockerfile ?? defaults.fpm),
      webBuildTarget: params.ecs.webBuildTarget,
      phpFpmBuildTarget: containerTopology === ContainerTopology.SINGLE ? undefined : params.ecs.phpFpmBuildTarget,
    };
  }

  /**
   * Container variables: the repository's own, plus the values produced by
   * the other stacks of the stage.
   */
  private ecsVariables(params: EnvironmentParameters, region: string, distributionIdsParameterName: string) {
    const env = params.environmentName;
    const ecs = params.ecs;
    const serviceUsers = params.serviceIamUsers ?? [];
    const ssmVariables: { [variable: string]: string } = {};
    const secretVariables: { [variable: string]: TmSecretField } = {};
    const plainVariables: { [variable: string]: string } = {};

    if (ecs.wireStageOutputs ?? true) {
      ssmVariables.TM_DATABASE_WRITER_HOSTNAME = TmParameterNames.rdsWriterEndpoint(env);
      ssmVariables.TM_REDIS_HOSTNAME = TmParameterNames.redisPrimaryEndpoint(env);

      if (params.solr) {
        ssmVariables.TM_SOLR_WRITER_HOSTNAME = TmParameterNames.solrWriterEndpoint(env);
        ssmVariables.TM_SOLR_WRITER_PORT = TmParameterNames.solrWriterPort(env);
      }

      if (params.fal.storage === FalStorage.S3) {
        ssmVariables.TM_S3ASSETS_BUCKET_NAME = TmParameterNames.s3ContentBucketName(env);
        plainVariables.TM_S3ASSETS_REGION = region;
        if (params.cdn) {
          plainVariables.TM_S3ASSETS_DOMAIN = params.cdn.domain;
        }
        if (serviceUsers.includes(ServiceIamUser.S3)) {
          const secretArnParameterName = TmParameterNames.serviceUserCredentialsSecretArn(env, 's3-service');
          secretVariables.TM_S3ASSETS_ACCESS_KEY_ID = { secretArnParameterName, field: 'AccessKeyId' };
          secretVariables.TM_S3ASSETS_SECRET_KEY = { secretArnParameterName, field: 'SecretAccessKey' };
        }
      }
    }

    if (ecs.cloudfrontIntegration) {
      if (!params.cloudfront || !serviceUsers.includes(ServiceIamUser.CLOUDFRONT)) {
        throw new Error('ecs.cloudfrontIntegration requires cloudfront and the ServiceIamUser.CLOUDFRONT service user.');
      }
      ssmVariables.TM_CLOUDFRONT_DISTRIBUTION_IDS = distributionIdsParameterName;
      const secretArnParameterName = TmParameterNames.serviceUserCredentialsSecretArn(env, 'cloudfront-service');
      secretVariables.TM_CLOUDFRONT_APIKEY = { secretArnParameterName, field: 'AccessKeyId' };
      secretVariables.TM_CLOUDFRONT_APISECRET = { secretArnParameterName, field: 'SecretAccessKey' };
    }

    // With bootstrap, the application password is the secret GENERATED by the
    // RDS stack. ECS reads it through its published ARN parameter (single-value
    // secret: no JSON field), so the bootstrap Lambda and ECS read the SAME ARN
    // (single source of truth). It must therefore NOT appear in the
    // human-managed secretsFromSecretsManager block (removed from
    // environment-parameters).
    if (params.rds?.bootstrap?.enabled) {
      const applicationName = ecs.applicationName ?? 'tm';
      secretVariables.TM_DATABASE_PASSWORD = {
        secretArnParameterName: TmParameterNames.generatedSecretArn(applicationName, 'TM_DATABASE_PASSWORD'),
      };
    }

    const secretsFromSsmParameterStore = ecs.secretsFromSsmParameterStore ?? [];
    const generatedSecrets = ecs.generatedSecrets ?? [];
    const wired = [...Object.keys(ssmVariables), ...Object.keys(secretVariables), ...Object.keys(plainVariables)];
    const handMadeNames = [...secretsFromSsmParameterStore, ...Object.keys(ecs.secretsFromSecretsManager ?? {}), ...generatedSecrets];
    const duplicates = handMadeNames.filter(name => wired.includes(name));
    if (duplicates.length > 0) {
      throw new Error(`These variables are produced by the stage, remove them from ecs.secretsFromSsmParameterStore / ecs.secretsFromSecretsManager / ecs.generatedSecrets: ${duplicates.join(', ')}.`);
    }

    return {
      secretsFromSsmParameterStore,
      additionalSecretsFromParameterStore: { ...ssmVariables, ...ecs.additionalSecretsFromParameterStore },
      secretsFromSecretsManager: { ...secretVariables, ...ecs.secretsFromSecretsManager },
      generatedSecrets,
      environment: { ...plainVariables, ...ecs.environment },
    };
  }
}

function toPascalCase(input: string): string {
  return input
    .split(/[\s_\-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
