import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as fs from 'fs';
import * as path from 'path';

export interface TmS3StackProps extends cdk.StackProps {}

export class TmS3Stack extends cdk.Stack {
    public readonly logBucket: s3.Bucket;
    public readonly errorBucket: s3.Bucket;
    public readonly contentBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props: TmS3StackProps) {

        super(scope, id, props);

        // BUCKETS
        this.logBucket = new s3.Bucket(this, 'LogBucket',{
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
        });

        this.errorBucket = new s3.Bucket(this, 'ErrorBucket', {
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
        });

        this.contentBucket = new s3.Bucket(this, 'CdnContenu', {
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
        });

        // Deploy error pages files
        const errorsResponsePagesFilesPath = path.join(__dirname, 'cloudfront', 'error-pages');
        if (fs.existsSync(errorsResponsePagesFilesPath)) {
            new s3Deployment.BucketDeployment(this, 'DeployErrorPages', {
                sources: [s3Deployment.Source.asset(path.join(__dirname, 'cloudfront', 'error-pages'))],
                destinationBucket: this.errorBucket,
                destinationKeyPrefix: 'errors',
            });
        }

    }
}