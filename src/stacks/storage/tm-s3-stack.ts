import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { publishParameter } from '../common/references';

/**
 * Props for `TmS3Stack`.
 */
export interface TmS3StackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * Creates the FAL content bucket, served by the CDN distribution.
   *
   * @default false
   */
  readonly contentBucket?: boolean;

  /**
   * Creates the bucket receiving the CloudFront access logs.
   *
   * @default false
   */
  readonly logBucket?: boolean;

  /**
   * Days before CloudFront access logs are deleted.
   *
   * @default 365
   */
  readonly logRetentionDays?: number;

  /**
   * Local directory of error pages (`<code>.html`). When set, an error bucket
   * is created and the pages are deployed under `errors/`.
   *
   * @default - no error bucket
   */
  readonly errorPagesPath?: string;
}

/**
 * Buckets used by the distributions: FAL content, CloudFront access logs and
 * error pages. CloudFront distributions of the account read the content and
 * error buckets through origin access control. Publishes the bucket names in
 * SSM.
 */
export class TmS3Stack extends cdk.Stack {
  /** The FAL content bucket. */
  public readonly contentBucket?: s3.Bucket;
  /** The CloudFront access log bucket. */
  public readonly logBucket?: s3.Bucket;
  /** The error page bucket. */
  public readonly errorBucket?: s3.Bucket;

  constructor(scope: Construct, id: string, props: TmS3StackProps) {
    super(scope, id, props);

    const env = props.environmentName;

    if (props.logBucket) {
      this.logBucket = new s3.Bucket(this, 'LogBucket', {
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        // CloudFront standard logging writes with ACLs.
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        lifecycleRules: [{ expiration: cdk.Duration.days(props.logRetentionDays ?? 365) }],
      });
      publishParameter(this, 'LogBucketNameParameter', TmParameterNames.s3LogBucketName(env), this.logBucket.bucketName);
    }

    if (props.errorPagesPath) {
      this.errorBucket = new s3.Bucket(this, 'ErrorBucket', {
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
      });
      this.allowCloudfrontRead(this.errorBucket);
      new s3Deployment.BucketDeployment(this, 'DeployErrorPages', {
        sources: [s3Deployment.Source.asset(props.errorPagesPath)],
        destinationBucket: this.errorBucket,
        destinationKeyPrefix: 'errors',
      });
      publishParameter(this, 'ErrorBucketNameParameter', TmParameterNames.s3ErrorBucketName(env), this.errorBucket.bucketName);
    }

    if (props.contentBucket) {
      this.contentBucket = new s3.Bucket(this, 'CdnContenu', {
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        versioned: true,
        // Deleted and overwritten files are kept 90 days.
        lifecycleRules: [{ noncurrentVersionExpiration: cdk.Duration.days(90) }],
      });
      this.allowCloudfrontRead(this.contentBucket);
      publishParameter(this, 'ContentBucketNameParameter', TmParameterNames.s3ContentBucketName(env), this.contentBucket.bucketName);
    }
  }

  /**
   * The distributions import the bucket by name, so the origin access control
   * grant lives here. It covers the account's distributions, which avoids a
   * dependency on the distribution stacks.
   */
  private allowCloudfrontRead(bucket: s3.Bucket) {
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [bucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringLike: {
          'AWS:SourceArn': `arn:${this.partition}:cloudfront::${this.account}:distribution/*`,
        },
      },
    }));
  }
}
