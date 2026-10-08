/**
 * Names of the SSM parameters the package creates and reads.
 *
 * Convention: `/tm/<env>/<component>/<resource>/<attribute>`, lower-kebab-case,
 * e.g. `/tm/prod/rds/cluster/writer-endpoint`. `<env>` is the
 * `environmentName` of the environment parameters.
 *
 * Producer stacks write these parameters and consumer stacks read them at
 * deploy time, so no stack imports another stack's CloudFormation exports.
 */
export class TmParameterNames {
  /**
   * Prefix of every parameter created by the package.
   */
  public static readonly PREFIX = '/tm';

  /**
   * Builds a parameter name that follows the convention.
   */
  public static of(environmentName: string, component: string, resource: string, attribute: string): string {
    for (const segment of [environmentName, component, resource, attribute]) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(segment)) {
        throw new Error(`Invalid SSM parameter name segment '${segment}': use lower-kebab-case.`);
      }
    }
    return `${TmParameterNames.PREFIX}/${environmentName}/${component}/${resource}/${attribute}`;
  }

  /** VPC ID. */
  public static vpcId(env: string): string {
    return TmParameterNames.of(env, 'vpc', 'vpc', 'id');
  }

  /** Comma-separated public subnet IDs, in availability-zone order. */
  public static vpcPublicSubnetIds(env: string): string {
    return TmParameterNames.of(env, 'vpc', 'subnets', 'public-ids');
  }

  /** Comma-separated private (with egress) subnet IDs, in availability-zone order. */
  public static vpcPrivateSubnetIds(env: string): string {
    return TmParameterNames.of(env, 'vpc', 'subnets', 'private-ids');
  }

  /** Comma-separated isolated subnet IDs, in availability-zone order. */
  public static vpcIsolatedSubnetIds(env: string): string {
    return TmParameterNames.of(env, 'vpc', 'subnets', 'isolated-ids');
  }

  /** Private hosted zone ID attached to the VPC. */
  public static vpcHostedZoneId(env: string): string {
    return TmParameterNames.of(env, 'vpc', 'hosted-zone', 'id');
  }

  /** Bastion security group ID. */
  public static bastionSecurityGroupId(env: string): string {
    return TmParameterNames.of(env, 'bastion', 'instance', 'security-group-id');
  }

  /** RDS cluster security group ID. */
  public static rdsSecurityGroupId(env: string): string {
    return TmParameterNames.of(env, 'rds', 'cluster', 'security-group-id');
  }

  /** RDS cluster writer endpoint hostname. */
  public static rdsWriterEndpoint(env: string): string {
    return TmParameterNames.of(env, 'rds', 'cluster', 'writer-endpoint');
  }

  /** RDS cluster reader endpoint hostname. */
  public static rdsReaderEndpoint(env: string): string {
    return TmParameterNames.of(env, 'rds', 'cluster', 'reader-endpoint');
  }

  /** RDS cluster ARN. */
  public static rdsClusterArn(env: string): string {
    return TmParameterNames.of(env, 'rds', 'cluster', 'arn');
  }

  /** Redis security group ID. */
  public static redisSecurityGroupId(env: string): string {
    return TmParameterNames.of(env, 'redis', 'cluster', 'security-group-id');
  }

  /** Redis primary endpoint hostname. */
  public static redisPrimaryEndpoint(env: string): string {
    return TmParameterNames.of(env, 'redis', 'cluster', 'primary-endpoint');
  }

  /** Solr security group ID. */
  public static solrSecurityGroupId(env: string): string {
    return TmParameterNames.of(env, 'solr', 'instance', 'security-group-id');
  }

  /** Solr writer endpoint hostname. */
  public static solrWriterEndpoint(env: string): string {
    return TmParameterNames.of(env, 'solr', 'instance', 'writer-endpoint');
  }

  /** Solr writer port. */
  public static solrWriterPort(env: string): string {
    return TmParameterNames.of(env, 'solr', 'instance', 'writer-port');
  }

  /** DNS name of the application load balancer. */
  public static ecsLoadBalancerDnsName(env: string): string {
    return TmParameterNames.of(env, 'ecs', 'load-balancer', 'dns-name');
  }

  /** FAL content bucket name. */
  public static s3ContentBucketName(env: string): string {
    return TmParameterNames.of(env, 's3', 'content-bucket', 'name');
  }

  /** CloudFront access log bucket name. */
  public static s3LogBucketName(env: string): string {
    return TmParameterNames.of(env, 's3', 'log-bucket', 'name');
  }

  /** CloudFront error page bucket name. */
  public static s3ErrorBucketName(env: string): string {
    return TmParameterNames.of(env, 's3', 'error-bucket', 'name');
  }

  /**
   * Name of the pipeline-level bootstrap-assets bucket, holding the database
   * dump (`db/latest.sql`) and any future seed asset. Published by
   * `TmBootstrapAssetsStack` and read by the RDS bootstrap construct.
   */
  public static bootstrapAssetsBucketName(env: string): string {
    return TmParameterNames.of(env, 'bootstrap', 'assets-bucket', 'name');
  }

  /**
   * SSM parameter holding the complete ARN of a CDK-generated application
   * secret. The generated-secrets path (`TmEcsStack.buildSecrets`) publishes
   * every generated secret's ARN here, under the application namespace rather
   * than the `/tm/...` one. It is the single source of truth both ECS and the
   * RDS bootstrap read for a shared generated secret such as
   * `TM_DATABASE_PASSWORD`.
   *
   * @param applicationName the ECS `applicationName` (secrets path segment)
   * @param name the variable name, e.g. `TM_DATABASE_PASSWORD`
   */
  public static generatedSecretArn(applicationName: string, name: string): string {
    return `/applications/${applicationName}/generated/${name}-arn`;
  }

  /**
   * ARN of the Secrets Manager secret holding a service user's access key
   * (`AccessKeyId` and `SecretAccessKey` fields).
   *
   * @param user the user's kebab-case resource name, e.g. `s3-service`
   */
  public static serviceUserCredentialsSecretArn(env: string, user: string): string {
    return TmParameterNames.of(env, 'iam', user, 'credentials-secret-arn');
  }

  /** ARN of the CloudFront-scope WebACL, written in the application region. */
  public static wafWebAclArn(env: string): string {
    return TmParameterNames.of(env, 'waf', 'web-acl', 'arn');
  }

  /**
   * ID of a www distribution.
   *
   * @param index position of the domain in `cloudfront.domains` (0 for the first)
   */
  public static cloudfrontWwwDistributionId(env: string, index: number): string {
    return TmParameterNames.of(env, 'cloudfront', TmParameterNames.wwwResource(index), 'distribution-id');
  }

  /** ID of the CDN distribution. */
  public static cloudfrontCdnDistributionId(env: string): string {
    return TmParameterNames.of(env, 'cloudfront', 'cdn', 'distribution-id');
  }

  /**
   * Default name of the distribution-ID parameter read by tm_cloudfront and the
   * pipeline invalidation step.
   */
  public static cloudfrontDistributionIds(env: string): string {
    return TmParameterNames.of(env, 'cloudfront', 'distributions', 'ids');
  }

  /**
   * Default name of the hand-made parameter holding the ACM certificate ARN
   * (us-east-1) of a www distribution.
   */
  public static cloudfrontWwwCertificateArn(env: string, index: number): string {
    return TmParameterNames.of(env, 'cloudfront', TmParameterNames.wwwResource(index), 'certificate-arn');
  }

  /**
   * Default name of the hand-made parameter holding the ACM certificate ARN
   * (us-east-1) of the CDN distribution.
   */
  public static cloudfrontCdnCertificateArn(env: string): string {
    return TmParameterNames.of(env, 'cloudfront', 'cdn', 'certificate-arn');
  }

  /**
   * Default name of the hand-made parameter holding the secret header value
   * that CloudFront sends to the load balancer (`X-Custom-Header`).
   */
  public static cloudfrontOriginCustomHeader(env: string): string {
    return TmParameterNames.of(env, 'cloudfront', 'origin', 'custom-header');
  }

  /**
   * Default name of the hand-made parameter holding the base64
   * `user:password` of the www basic authentication.
   */
  public static cloudfrontBasicAuth(env: string): string {
    return TmParameterNames.of(env, 'cloudfront', 'www', 'basic-auth');
  }

  /** Public IP (Elastic IP) of the redirection instance. */
  public static redirectionsPublicIp(env: string): string {
    return TmParameterNames.of(env, 'redirections', 'instance', 'public-ip');
  }

  private static wwwResource(index: number): string {
    return index === 0 ? 'www' : `www-${index + 1}`;
  }
}
