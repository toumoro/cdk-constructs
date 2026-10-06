import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { TmDistributionIdsOptions, TmDistributionIdsParameter } from './distribution-ids-parameter';
import { TmCachePolicy } from '../../cdn/cloudfront/cachePolicy';
import { TmParameterNames } from '../../config/parameter-names';
import { publishParameter, readParameter } from '../common/references';

/**
 * Props for `TmCloudfrontStack`.
 */
export interface TmCloudfrontStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * One distribution per domain. Distributions are identified by position.
   */
  readonly domains: string[];

  /**
   * Extra aliases of a distribution, keyed by an entry of `domains`.
   *
   * @default {}
   */
  readonly additionalDomains?: { [domain: string]: string[] };

  /**
   * ACM certificate ARNs (us-east-1), keyed by an entry of `domains`.
   *
   * @default - read from `TmParameterNames.cloudfrontWwwCertificateArn`
   */
  readonly certificateArns?: { [domain: string]: string };

  /**
   * SSM parameter holding the secret header value sent to the load balancer.
   */
  readonly originCustomHeaderParameterName: string;

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
   * Associates the WebACL of `TmWafStack` (ARN read from SSM).
   *
   * @default false
   */
  readonly webAcl?: boolean;

  /**
   * Writes access logs to the log bucket of `TmS3Stack`, under `www/`.
   *
   * @default false
   */
  readonly accessLogs?: boolean;

  /**
   * Serves `/errors/*` from the error bucket of `TmS3Stack` and uses those pages
   * for 4xx and 5xx responses.
   *
   * @default false
   */
  readonly errorPages?: boolean;

  /**
   * Writes the distribution-ID parameter for these distributions. Leave unset
   * when `TmCloudfrontCdnStack` writes it.
   *
   * @default - not written by this stack
   */
  readonly distributionIds?: TmDistributionIdsOptions;
}

/**
 * www distributions in front of the load balancer, one per domain, with the
 * TYPO3 cache policy and an uncached `/typo3/*` behavior. Publishes each
 * distribution ID in SSM.
 */
export class TmCloudfrontStack extends cdk.Stack {
  /** The distributions, in the order of `domains`. */
  public readonly distributions: cloudfront.Distribution[];

  constructor(scope: Construct, id: string, props: TmCloudfrontStackProps) {
    super(scope, id, props);

    const env = props.environmentName;
    this.distributions = [];

    const loadBalancerOrigin = new HttpOrigin(readParameter(this, TmParameterNames.ecsLoadBalancerDnsName(env)), {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      customHeaders: {
        'X-Custom-Header': readParameter(this, props.originCustomHeaderParameterName),
      },
    });

    const functionAssociations: cloudfront.FunctionAssociation[] = [];
    if (props.basicAuth) {
      const basicAuthBase64 = readParameter(this, props.basicAuthParameterName ?? TmParameterNames.cloudfrontBasicAuth(env));
      const authFunction = new cloudfront.Function(this, 'BasicAuthFunction', {
        functionName: 'BasicAuthFunction',
        code: cloudfront.FunctionCode.fromInline(`
          function handler(event) {
            var authHeaders = event.request.headers.authorization;
            var expected = "Basic ${basicAuthBase64}";
            if (authHeaders && authHeaders.value === expected) {
              return event.request;
            }
            return {
              statusCode: 401,
              statusDescription: "Unauthorized",
              headers: { "www-authenticate": { value: 'Basic realm="Authentification"' } },
            };
          }
        `),
      });
      functionAssociations.push({ function: authFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST });
    }

    const cachePolicy = new TmCachePolicy(this, 'DefaultCachePolicy', {});
    const webAclId = props.webAcl ? readParameter(this, TmParameterNames.wafWebAclArn(env)) : undefined;
    const logBucket = props.accessLogs
      ? s3.Bucket.fromBucketAttributes(this, 'LogBucket', {
        bucketName: readParameter(this, TmParameterNames.s3LogBucketName(env)),
        region: this.region,
      })
      : undefined;
    const errorBucketOrigin = props.errorPages
      ? S3BucketOrigin.withOriginAccessControl(s3.Bucket.fromBucketAttributes(this, 'ErrorBucket', {
        bucketName: readParameter(this, TmParameterNames.s3ErrorBucketName(env)),
        region: this.region,
      }))
      : undefined;
    if (errorBucketOrigin) {
      cdk.Annotations.of(this).acknowledgeWarning('@aws-cdk/aws-cloudfront-origins:updateImportedBucketPolicyOac',
        'TmS3Stack grants the account distributions read access to the bucket.');
    }

    props.domains.forEach((domain, index) => {
      // The first distribution keeps the unsuffixed ids of the fleet's stacks.
      const suffix = index === 0 ? '' : String(index + 1);
      const certificateArn = props.certificateArns?.[domain]
        ?? readParameter(this, TmParameterNames.cloudfrontWwwCertificateArn(env, index));

      const distribution = new cloudfront.Distribution(this, `CloudFrontDistribution${suffix}`, {
        domainNames: [domain, ...(props.additionalDomains?.[domain] ?? [])],
        certificate: acm.Certificate.fromCertificateArn(this, `Certificate${suffix}`, certificateArn),
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        webAclId,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        enableLogging: logBucket !== undefined,
        logBucket,
        logFilePrefix: logBucket ? 'www/' : undefined,
        defaultBehavior: {
          origin: loadBalancerOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy,
          functionAssociations,
        },
        errorResponses: errorBucketOrigin ? errorResponses() : undefined,
      });
      distribution.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

      distribution.addBehavior('/typo3/*', loadBalancerOrigin, {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        functionAssociations,
      });

      if (errorBucketOrigin) {
        distribution.addBehavior('/errors/*', errorBucketOrigin, {
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        });
      }

      publishParameter(this, `DistributionIdParameter${suffix}`,
        TmParameterNames.cloudfrontWwwDistributionId(env, index), distribution.distributionId);
      this.distributions.push(distribution);
    });

    if (props.distributionIds) {
      new TmDistributionIdsParameter(this, 'DistributionIds', props.distributionIds,
        props.domains.map((domain, index) => ({
          domains: [domain, ...(props.additionalDomains?.[domain] ?? [])],
          distributionId: this.distributions[index].distributionId,
        })));
    }
  }
}

function errorResponses(): cloudfront.ErrorResponse[] {
  return [400, 403, 500, 501, 502, 503, 504].map(code => ({
    httpStatus: code,
    responseHttpStatus: code,
    responsePagePath: `/errors/${code}.html`,
    ttl: cdk.Duration.seconds(30),
  }));
}
