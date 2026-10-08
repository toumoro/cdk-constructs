import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { publishParameter } from '../common/references';

/**
 * Props for `TmBootstrapAssetsStack`.
 */
export interface TmBootstrapAssetsStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;
}

/**
 * Pipeline-level stack (deployed BEFORE the pipeline itself): a single generic
 * S3 bucket, versioned and retained (RETAIN), meant for bootstrap assets. The
 * key convention reserves `db/latest.sql` for the database dump; the bucket can
 * receive other seed assets later.
 *
 * The bucket deploys before the pipeline, which leaves a window to upload the
 * dump before the stage imports it. The bucket name is published in an SSM
 * parameter (never a CloudFormation export) that the RDS stack reads at deploy
 * time.
 */
export class TmBootstrapAssetsStack extends cdk.Stack {
  /** The bootstrap assets bucket. */
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: TmBootstrapAssetsStackProps) {
    super(scope, id, props);

    const env = props.environmentName;

    // Retained bucket (bootstrap data must outlive the stack) and versioned
    // (like the other buckets of the repository, see TmS3Stack). Public access
    // blocked, S3-managed encryption, HTTPS required.
    this.bucket = new s3.Bucket(this, 'AssetsBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    publishParameter(this, 'AssetsBucketNameParameter',
      TmParameterNames.bootstrapAssetsBucketName(env), this.bucket.bucketName);
  }
}
