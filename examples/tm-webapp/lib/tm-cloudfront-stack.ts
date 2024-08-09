import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnOutput, Environment, RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { HttpOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { TmCachePolicy, TmCachePolicyProps } from '../../../src/cdn/cloudfront/cachePolicy';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as fs from 'fs';
import * as path from 'path';

export interface TmCloudfrontStackProps extends cdk.StackProps {
    readonly hostedZoneIdParameterName: string;
    readonly env: Environment;
    readonly retainLogBuckets?: boolean;
    readonly retainErrorBucket?: boolean;
    readonly webAclId?: string;
    readonly errorCachingMinTtl?: number;
    readonly applicationLoadbalancersDnsNames: string[];
    readonly loadBalancerOriginProtocol?: cloudfront.OriginProtocolPolicy;
    readonly viewerProtocolPolicy?: cloudfront.ViewerProtocolPolicy;
    readonly customHttpHeaderParameterName: string;
    readonly domainParameterName: string;
    readonly enableAcceptEncodingBrotli?: boolean,
    readonly enableAcceptEncodingGzip?: boolean,
    readonly cachePolicyDefaultTtl?: number,
    readonly cachePolicyMaxTtl?: number,
    readonly cachePolicyMinTtl?: number,
    readonly additionalCookies?: string[];
    readonly additionalHeaders?: string[];
    readonly queryStrings?: string[];
}

export class TmCloudfrontStack extends cdk.Stack {

    private certificate: Certificate;
    private logBucket: Bucket;
    private errorsBucket: Bucket;
    private errorsBucketOrigin: S3Origin;
    private loadBalancerOrigins: HttpOrigin[] = [];
    private distribution: cloudfront.Distribution;


    constructor(scope: Construct, id: string, props: TmCloudfrontStackProps) {

        super(scope, id, props);

        this.certificate = new Certificate(this, 'Certificate', {
            domainName: ssm.StringParameter.valueForStringParameter(this, props.domainParameterName),
            validation: CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this,
                'HostedZoneId',
                ssm.StringParameter.valueForStringParameter(this, props.hostedZoneIdParameterName)
            ),
            )
        });

        // BUCKETS
        const logBucketsRemovalPolicy = props.retainLogBuckets ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

        if (logBucketsRemovalPolicy === RemovalPolicy.DESTROY) {
            this.logBucket = new Bucket(this, 'LogBucket', {
                removalPolicy: RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
                objectOwnership: ObjectOwnership.OBJECT_WRITER,
            });
        }
        else {
            this.logBucket = new Bucket(this, 'LogBucket', {
                removalPolicy: RemovalPolicy.RETAIN,
                objectOwnership: ObjectOwnership.OBJECT_WRITER,
            });
        }

        const errorBucketsRemovalPolicy = props.retainErrorBucket ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

        if (errorBucketsRemovalPolicy === RemovalPolicy.DESTROY) {
            this.errorsBucket = new Bucket(this, 'ErrorsBucket', {
                removalPolicy: RemovalPolicy.DESTROY,
                autoDeleteObjects: true,
                blockPublicAccess: new s3.BlockPublicAccess({
                    blockPublicPolicy: false,
                    restrictPublicBuckets: false,
                })
            });
        }
        else {
            this.errorsBucket = new Bucket(this, 'ErrorsBucket', {
                removalPolicy: RemovalPolicy.DESTROY,
                blockPublicAccess: new s3.BlockPublicAccess({
                    blockPublicPolicy: false,
                    restrictPublicBuckets: false,
                })
            });
        }

        // Deploy error pages files
        const errorsResponsePagesFilesPath = path.join(__dirname, 'cloudfront', 'error-pages');
        if (fs.existsSync(errorsResponsePagesFilesPath)) {
            new s3Deployment.BucketDeployment(this, 'DeployErrorPages', {
                sources: [s3Deployment.Source.asset(path.join(__dirname, 'cloudfront', 'error-pages'))],
                destinationBucket: this.errorsBucket,
                destinationKeyPrefix: 'errors',
            });
        }

        //  Origins
        this.errorsBucketOrigin = new S3Origin(this.errorsBucket);

        for (const loadBalancerDnsName of props.applicationLoadbalancersDnsNames) {
            const httpOrigin = new HttpOrigin(loadBalancerDnsName, {
                protocolPolicy: props.loadBalancerOriginProtocol || cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
                customHeaders: {
                    'X-Custom-Header': ssm.StringParameter.valueForStringParameter(this, props.customHttpHeaderParameterName),
                }
            });
            this.loadBalancerOrigins.push(httpOrigin);
        }

        // Default Behavior Cache Policy
        const tmCachePolicyProps: TmCachePolicyProps = {
            enableAcceptEncodingBrotli: props.enableAcceptEncodingBrotli,
            enableAcceptEncodingGzip: props.enableAcceptEncodingGzip,
            defaultTtl: cdk.Duration.seconds(props.cachePolicyDefaultTtl ?? 86400),
            maxTtl: cdk.Duration.seconds(props.cachePolicyMaxTtl ?? 31536000),
            minTtl: cdk.Duration.seconds(props.cachePolicyMinTtl ?? 0),
            additionalCookies: props.additionalCookies,
            additionalHeaders: props.additionalHeaders,
            queryStrings: props.queryStrings,

        };

        // Basic-Auth cloudfront function
        const authFunctionCode = fs.readFileSync(path.join(__dirname, 'cloudfront', 'functions', 'basic-auth-function.js'), 'utf8');
        const authFunction = new cloudfront.Function(this, 'BasicAuthFunction', {
            functionName: 'BasicAuthFunction',
            code: cloudfront.FunctionCode.fromInline(authFunctionCode),
        });

        // Basic-Auth Lambda@Edge function
        // const edgeFunction = new lambda.Function(this, 'BasicAuthFunction', {
        //     runtime: lambda.Runtime.NODEJS_18_X, 
        //     code: lambda.Code.fromAsset(path.join(__dirname, 'cloudfront', 'functions', 'basic-auth-function.zip')),
        //     handler: 'basic-auth-function.handler',
        // });
        // // Add IAM policy to allow Lambda to read from SSM Parameter Store
        // edgeFunction.addToRolePolicy(new iam.PolicyStatement({
        //     actions: ['ssm:GetParameter'],
        //     resources: [
        //         `arn:aws:ssm:${this.region}:${this.account}:parameter/*`,
        //     ],
        // }));

        // Default Behavior
        const defaultBehavior = {
            origin: this.loadBalancerOrigins[0], // the first LoadBalancer origin in the list
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: new TmCachePolicy(this, 'DefaultCachePolicy', tmCachePolicyProps),
            functionAssociations: [{
                function: authFunction,
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            }],
            // edgeLambdas: [
            //     {
            //         functionVersion: edgeFunction.currentVersion,
            //         eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
            //     },
            // ],
        }

        // Error Responses
        const errorCodes: number[] = [400, 403, 500, 501, 502, 503, 504];
        const errorResponsesObjects: cloudfront.ErrorResponse[] = [];
        for (const code of errorCodes) {
            errorResponsesObjects.push(
                {
                    httpStatus: code,
                    responseHttpStatus: code,
                    responsePagePath: `/errors/${code}.html`,
                    ttl: cdk.Duration.seconds(30),
                }
            )
        }

        // Distribution
        this.distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
            domainNames: [ssm.StringParameter.valueForStringParameter(this, props.domainParameterName)],
            certificate: this.certificate,
            logBucket: this.logBucket,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            webAclId: props.webAclId,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: defaultBehavior,
            errorResponses: errorResponsesObjects
        });

        this.distribution.addBehavior('/typo3/*', this.loadBalancerOrigins[0], {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: props.viewerProtocolPolicy || cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
            functionAssociations: [{
                function: authFunction,
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            }],
            // edgeLambdas: [
            //     {
            //         functionVersion: edgeFunction.currentVersion,
            //         eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
            //     },
            // ],
        });


        // Error Behavior
        this.distribution.addBehavior('/errors/*', this.errorsBucketOrigin, {
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        });



        new CfnOutput(this, 'DistributionID', {
            value: this.distribution.distributionId,
        });
    }
}

