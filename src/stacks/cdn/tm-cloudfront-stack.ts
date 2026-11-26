import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin, VpcOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { TmDistributionIdsOptions, TmDistributionIdsParameter } from './distribution-ids-parameter';
import { TmCachePolicy } from '../../cdn/cloudfront/cachePolicy';
import { ResponseHeadersSettings } from '../../config/environment-parameters';
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
   * Reaches the load balancer through a CloudFront VPC origin over HTTPS 443,
   * its ARN and DNS name read from the `vpc-origin` SSM parameters published
   * by `TmEcsStack` (the internal load balancer, or the bridge during the
   * migration). When false, the origin is the public load balancer's DNS name
   * over HTTP 80.
   *
   * @default false
   */
  readonly vpcOrigin?: boolean;

  /**
   * The `vpc-origin` SSM parameters point at the migration bridge rather than
   * the service load balancer (`vpcOriginBridge` without `vpcOrigin`).
   *
   * CloudFront refuses to modify a VPC origin while a distribution uses it, so
   * each endpoint gets its own VPC origin resource: moving from the bridge to
   * the service load balancer creates the new VPC origin, repoints the
   * distribution, then deletes the old one.
   *
   * @default false
   */
  readonly vpcOriginViaBridge?: boolean;

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
   * Serves the FAL content bucket of `TmS3Stack` under this path (e.g.
   * `/fileadmin`), path removed, with a strict Content-Security-Policy.
   *
   * @default - the content bucket is not served
   */
  readonly falPath?: string;

  /**
   * Content-Security-Policy of the files under `falPath`.
   *
   * @default - a strict, sandboxed policy
   */
  readonly falContentSecurityPolicy?: string;

  /**
   * Response headers policy on every behavior (CORS for the distribution's
   * domains, HSTS and security headers, no CSP); the FAL behavior gets a copy
   * with its CSP.
   *
   * @default - no response headers policy
   */
  readonly responseHeaders?: ResponseHeadersSettings;

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

    const customHeaders = {
      'X-Custom-Header': readParameter(this, props.originCustomHeaderParameterName),
    };
    const loadBalancerOrigin: cloudfront.IOrigin = props.vpcOrigin
      ? VpcOrigin.withVpcOrigin(
        // One resource per endpoint (see vpcOriginViaBridge); the name is
        // generated from the construct path, unique per stage and account.
        new cloudfront.VpcOrigin(this, props.vpcOriginViaBridge ? 'BridgeVpcOrigin' : 'ServiceVpcOrigin', {
          // The endpoint is built from the published ARN and DNS name, so the
          // load balancer itself is not imported (that would need its
          // security group too, for nothing).
          endpoint: new LoadBalancerEndpoint(
            readParameter(this, TmParameterNames.ecsVpcOriginLoadBalancerArn(env)),
            readParameter(this, TmParameterNames.ecsVpcOriginLoadBalancerDnsName(env))),
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          httpsPort: 443,
          originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
        }),
        { customHeaders })
      : new HttpOrigin(readParameter(this, TmParameterNames.ecsLoadBalancerDnsName(env)), {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        customHeaders,
      });

    const functionAssociations: cloudfront.FunctionAssociation[] = [];
    // Returns the 401 response when the request lacks the credentials, in the
    // viewer-request functions (one per behavior, so the FAL one repeats it).
    let basicAuthCheck = '';
    if (props.basicAuth) {
      const basicAuthBase64 = readParameter(this, props.basicAuthParameterName ?? TmParameterNames.cloudfrontBasicAuth(env));
      basicAuthCheck = `
            var authHeaders = event.request.headers.authorization;
            if (!authHeaders || authHeaders.value !== "Basic ${basicAuthBase64}") {
              return {
                statusCode: 401,
                statusDescription: "Unauthorized",
                headers: { "www-authenticate": { value: 'Basic realm="Authentification"' } },
              };
            }`;
      const authFunction = new cloudfront.Function(this, 'BasicAuthFunction', {
        functionName: 'BasicAuthFunction',
        code: cloudfront.FunctionCode.fromInline(`
          function handler(event) {${basicAuthCheck}
            return event.request;
          }
        `),
      });
      functionAssociations.push({ function: authFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST });
    }

    const cachePolicy = new TmCachePolicy(this, 'DefaultCachePolicy', {});
    // TYPO3 checks the Referer (backend, Install Tool); forwarded, not part of the cache key.
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'DefaultOriginRequestPolicy', {
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList('Referer'),
    });
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
    const falOrigin = props.falPath !== undefined
      ? S3BucketOrigin.withOriginAccessControl(s3.Bucket.fromBucketAttributes(this, 'ContentBucket', {
        bucketName: readParameter(this, TmParameterNames.s3ContentBucketName(env)),
        region: this.region,
      }))
      : undefined;
    const falFunctionAssociations = props.falPath !== undefined
      ? this.falFunctionAssociations(props.falPath, basicAuthCheck)
      : [];
    const falCsp = props.falContentSecurityPolicy ?? FAL_CSP;
    // Without responseHeaders, one CSP-only policy serves every distribution.
    const falCspOnlyPolicy = props.falPath !== undefined && !props.responseHeaders
      ? new cloudfront.ResponseHeadersPolicy(this, 'FalResponseHeadersPolicy', {
        comment: 'Content-Security-Policy of the FAL files',
        securityHeadersBehavior: {
          contentSecurityPolicy: { contentSecurityPolicy: falCsp, override: true },
          contentTypeOptions: { override: true },
        },
      })
      : undefined;
    if (errorBucketOrigin || falOrigin) {
      cdk.Annotations.of(this).acknowledgeWarning('@aws-cdk/aws-cloudfront-origins:updateImportedBucketPolicyOac',
        'TmS3Stack grants the account distributions read access to the bucket.');
    }

    props.domains.forEach((domain, index) => {
      // The first distribution keeps the unsuffixed ids of the fleet's stacks.
      const suffix = index === 0 ? '' : String(index + 1);
      const certificateArn = props.certificateArns?.[domain]
        ?? readParameter(this, TmParameterNames.cloudfrontWwwCertificateArn(env, index));
      const domainNames = [domain, ...(props.additionalDomains?.[domain] ?? [])];
      // One policy per distribution: the CORS origins are its own domains.
      const responseHeadersPolicy = props.responseHeaders
        ? this.responseHeadersPolicy(`ResponseHeadersPolicy${suffix}`, domainNames, props.responseHeaders)
        : undefined;
      // A behavior takes a single policy: the FAL one repeats the headers above and adds the CSP.
      const falResponseHeadersPolicy = props.falPath !== undefined && props.responseHeaders
        ? this.responseHeadersPolicy(`FalResponseHeadersPolicy${suffix}`, domainNames, props.responseHeaders, falCsp)
        : falCspOnlyPolicy;

      const distribution = new cloudfront.Distribution(this, `CloudFrontDistribution${suffix}`, {
        domainNames,
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
          originRequestPolicy,
          functionAssociations,
          responseHeadersPolicy,
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
        responseHeadersPolicy,
      });

      if (errorBucketOrigin) {
        distribution.addBehavior('/errors/*', errorBucketOrigin, {
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy,
        });
      }

      if (falOrigin) {
        distribution.addBehavior(`${props.falPath}/*`, falOrigin, {
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          functionAssociations: falFunctionAssociations,
          responseHeadersPolicy: falResponseHeadersPolicy,
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

  /**
   * CORS for the distribution's domains plus the additional origins, HSTS and
   * security headers; the CORS headers of the origin win, the security headers
   * of CloudFront do. No Content-Security-Policy, which the application sets,
   * except `falCsp` for the FAL files (with `nosniff` in any case).
   */
  private responseHeadersPolicy(id: string, domainNames: string[], settings: ResponseHeadersSettings, falCsp?: string) {
    return new cloudfront.ResponseHeadersPolicy(this, id, {
      comment: falCsp !== undefined
        ? `FAL files of ${domainNames[0]}: CSP, CORS, HSTS and security headers`
        : `CORS for ${domainNames[0]}, HSTS and security headers`,
      corsBehavior: {
        accessControlAllowOrigins: [
          ...domainNames.map(name => `https://${name}`),
          ...(settings.additionalCorsOrigins ?? []),
        ],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowHeaders: ['*'],
        accessControlAllowCredentials: false,
        accessControlMaxAge: cdk.Duration.minutes(10),
        originOverride: false,
      },
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: settings.strictTransportSecurity?.maxAge ?? cdk.Duration.days(365),
          includeSubdomains: settings.strictTransportSecurity?.includeSubdomains ?? true,
          preload: settings.strictTransportSecurity?.preload ?? true,
          override: true,
        },
        contentSecurityPolicy: falCsp !== undefined ? { contentSecurityPolicy: falCsp, override: true } : undefined,
        contentTypeOptions: (falCsp !== undefined || (settings.contentTypeOptions ?? true)) ? { override: true } : undefined,
        frameOptions: {
          frameOption: settings.frameOption ?? cloudfront.HeadersFrameOption.SAMEORIGIN,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: settings.referrerPolicy ?? cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [{
          header: 'Permissions-Policy',
          value: settings.permissionsPolicy
            ?? 'accelerometer=(), camera=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), geolocation=()',
          override: true,
        }],
      },
      removeHeaders: settings.removeHeaders ?? ['Server', 'X-Powered-By'],
    });
  }

  /**
   * Viewer request function of the FAL behavior: checks basic auth (if any)
   * and removes the path, since the bucket keys have no prefix.
   */
  private falFunctionAssociations(falPath: string, basicAuthCheck: string): cloudfront.FunctionAssociation[] {
    const request = new cloudfront.Function(this, 'FalRequestFunction', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: `Removes ${falPath} before the FAL content bucket`,
      code: cloudfront.FunctionCode.fromInline(`
          function handler(event) {${basicAuthCheck}
            var request = event.request;
            request.uri = request.uri.substring(${falPath.length});
            return request;
          }
        `),
    });
    return [{ function: request, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }];
  }
}

/** Default Content-Security-Policy of the files under the FAL path. */
const FAL_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; "
  + "frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox";

function errorResponses(): cloudfront.ErrorResponse[] {
  return [400, 403, 500, 501, 502, 503, 504].map(code => ({
    httpStatus: code,
    responseHttpStatus: code,
    responsePagePath: `/errors/${code}.html`,
    ttl: cdk.Duration.seconds(30),
  }));
}

/**
 * A VPC origin endpoint given by its ARN and domain name (an application load
 * balancer published in SSM by `TmEcsStack`).
 */
class LoadBalancerEndpoint extends cloudfront.VpcOriginEndpoint {
  constructor(public readonly endpointArn: string, public readonly domainName: string) {
    super();
  }
}
