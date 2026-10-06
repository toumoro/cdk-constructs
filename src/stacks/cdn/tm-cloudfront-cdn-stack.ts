import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { TmDistributionIdsOptions, TmDistributionIdsParameter } from './distribution-ids-parameter';
import { TmParameterNames } from '../../config/parameter-names';
import { publishParameter, readParameter } from '../common/references';

/**
 * Props for `TmCloudfrontCdnStack`.
 */
export interface TmCloudfrontCdnStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * Domain of the CDN distribution.
   */
  readonly domain: string;

  /**
   * ACM certificate ARN (us-east-1).
   *
   * @default - read from `TmParameterNames.cloudfrontCdnCertificateArn`
   */
  readonly certificateArn?: string;

  /**
   * Associates the WebACL of `TmWafStack` (ARN read from SSM).
   *
   * @default false
   */
  readonly webAcl?: boolean;

  /**
   * Writes access logs to the log bucket of `TmS3Stack`, under `cdn/`.
   *
   * @default false
   */
  readonly accessLogs?: boolean;

  /**
   * Writes the distribution-ID parameter, covering the www distributions of
   * `TmCloudfrontStack` (IDs read from SSM) and this one.
   *
   * @default - not written by this stack
   */
  readonly distributionIds?: TmDistributionIdsOptions;

  /**
   * Domains of the www distributions, in order, with their extra aliases.
   * Used for the distribution-ID parameter.
   *
   * @default []
   */
  readonly wwwDomains?: string[][];
}

/**
 * CDN distribution serving the FAL content bucket through origin access
 * control, with CORS headers for fonts and other cross-origin assets.
 * Publishes its ID in SSM.
 */
export class TmCloudfrontCdnStack extends cdk.Stack {
  /** The CDN distribution. */
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: TmCloudfrontCdnStackProps) {
    super(scope, id, props);

    const env = props.environmentName;

    const contentBucket = s3.Bucket.fromBucketAttributes(this, 'ContentBucket', {
      bucketName: readParameter(this, TmParameterNames.s3ContentBucketName(env)),
      region: this.region,
    });
    const logBucket = props.accessLogs
      ? s3.Bucket.fromBucketAttributes(this, 'LogBucket', {
        bucketName: readParameter(this, TmParameterNames.s3LogBucketName(env)),
        region: this.region,
      })
      : undefined;
    const certificateArn = props.certificateArn ?? readParameter(this, TmParameterNames.cloudfrontCdnCertificateArn(env));

    this.distribution = new cloudfront.Distribution(this, 'CloudFrontCdnDistribution', {
      domainNames: [props.domain],
      certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      webAclId: props.webAcl ? readParameter(this, TmParameterNames.wafWebAclArn(env)) : undefined,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableLogging: logBucket !== undefined,
      logBucket,
      logFilePrefix: logBucket ? 'cdn/' : undefined,
      defaultBehavior: {
        // The bucket policy granting read access lives in TmS3Stack.
        origin: S3BucketOrigin.withOriginAccessControl(contentBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_AND_SECURITY_HEADERS,
      },
    });
    this.distribution.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    cdk.Annotations.of(this.distribution).acknowledgeWarning('@aws-cdk/aws-cloudfront-origins:updateImportedBucketPolicyOac',
      'TmS3Stack grants the account distributions read access to the bucket.');

    publishParameter(this, 'DistributionIdParameter', TmParameterNames.cloudfrontCdnDistributionId(env), this.distribution.distributionId);

    if (props.distributionIds) {
      const wwwEntries = (props.wwwDomains ?? []).map((domains, index) => ({
        domains,
        distributionId: readParameter(this, TmParameterNames.cloudfrontWwwDistributionId(env, index)),
      }));
      new TmDistributionIdsParameter(this, 'DistributionIds', props.distributionIds, [
        ...wwwEntries,
        { domains: [props.domain], distributionId: this.distribution.distributionId },
      ]);
    }
  }
}
