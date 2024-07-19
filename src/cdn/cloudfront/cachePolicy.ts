import { Duration } from 'aws-cdk-lib';
import { CacheCookieBehavior, CacheHeaderBehavior, CachePolicy, CachePolicyProps, CacheQueryStringBehavior } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

/**
 * Represents the configuration for a Cache Policy.
 */

export interface TmCachePolicyProps extends CachePolicyProps {
  cachePolicyName?: string;
  cookieBehavior?: CacheCookieBehavior;
  headerBehavior?: CacheHeaderBehavior;
  queryStringBehavior?: CacheQueryStringBehavior;
  enableAcceptEncodingBrotli?: boolean;
  enableAcceptEncodingGzip?: boolean;
  defaultTtl?: Duration;
  maxTtl?: Duration;
  minTtl?: Duration;
  additionalCookies?: string[];
  additionalHeaders?: string[];
  additionalQueryStrings?: string[];
}


export class TmCachePolicy extends CachePolicy {
  /**
     * The CachePolicy created by the construct.
     */

  constructor(scope: Construct, id: string, props: TmCachePolicyProps) {

    const allowedCookies = [
      'be_lastLoginProvider',
      'be_typo_user',
      'fe_typo_user',
      'PHPSESSID',
      'ADMCMD_prev',
      'SimpleSAML',
      'SimpleSAMLAuthToken',
      ...(props.additionalCookies || []),
    ];

    const allowedHeaders = [
      'Authorization',
      'CloudFront-Forwarded-Proto',
      'Host',
      'Origin',
      ...(props.additionalHeaders || []),
    ];

    const allowedQueryStrings = [
      ...(props.additionalQueryStrings || []),
    ];

    const defaultProps: TmCachePolicyProps = {
      enableAcceptEncodingBrotli: true,
      enableAcceptEncodingGzip: true,
      cookieBehavior: CacheCookieBehavior.allowList(...allowedCookies),
      headerBehavior: CacheHeaderBehavior.allowList(...allowedHeaders),
      queryStringBehavior: allowedQueryStrings.length > 0
        ? CacheQueryStringBehavior.allowList(...allowedQueryStrings)
        : CacheQueryStringBehavior.all(),
    };

    const mergedProps = { ...defaultProps, ...props };

    super(scope, id, mergedProps);
  };
}