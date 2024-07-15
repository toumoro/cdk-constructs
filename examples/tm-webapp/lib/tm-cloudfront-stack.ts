import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
//import { VpcBase, TmVpcProps } from './vpc/vpc-base';
import { CfnOutput, Environment, RemovalPolicy } from 'aws-cdk-lib';
//import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { AllowedMethods, CachePolicy, Distribution, OriginProtocolPolicy, OriginRequestPolicy, PriceClass, SecurityPolicyProtocol, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { HttpOrigin, LoadBalancerV2Origin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
//import { BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';
//import * as path from 'path';
//import * as fs from 'fs';
//import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { ILoadBalancerV2 } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { TmCachePolicy, TmCachePolicyProps } from './cloudfront/cachePolicy';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface TmCloudfrontStackProps extends cdk.StackProps {
    readonly originDnsName: string;
    readonly domainName: string;
    readonly hostedZoneId: string;
    readonly env?: Environment;
    readonly additionalCookies?: string[];
    readonly retainLogBuckets?: boolean;
    readonly webAclId?: string;
    readonly errorCachingMinTtl?: number;
    readonly applicationLoadbalancer: ILoadBalancerV2;
    readonly loadBalancerOriginProtocol?: OriginProtocolPolicy;
    readonly viewerProtocolPolicy?: ViewerProtocolPolicy;

}

export class TmCloudfrontStack extends cdk.Stack {

    private certificate: Certificate;
    private logBucket: Bucket;
    private errorsBucket: Bucket;
    private errorsBucketOrigin: S3Origin;
    //private assetsBucketOrigin: HttpOrigin;
    private loadBalancerOrigin: HttpOrigin;
    private distribution: Distribution;
    //private s3Deployment?: BucketDeployment;


    constructor(scope: Construct, id: string, props: TmCloudfrontStackProps) {

        super(scope, id, props);

        this.certificate = new Certificate(this, 'Certificate', {
            domainName: props.domainName,
            validation: CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this, 'HostedZone', props.hostedZoneId)),
        });

        const logBucketsRemovalPolicy = props.retainLogBuckets ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

        this.logBucket = new Bucket(this, 'LogBucket', {
            removalPolicy: logBucketsRemovalPolicy,
            objectOwnership: ObjectOwnership.OBJECT_WRITER,
            autoDeleteObjects: true,
        });

        this.errorsBucket = new Bucket(this, 'ErrorsBucket');

        this.errorsBucketOrigin = new S3Origin(this.errorsBucket);

        // this.assetsBucketOrigin = new HttpOrigin(props.domainName, {
        //     protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
        // });

        this.loadBalancerOrigin = new LoadBalancerV2Origin(props.applicationLoadbalancer, {
            protocolPolicy: props.loadBalancerOriginProtocol || OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: {
                'X-Custom-Header': 'sdsdsdsdsd',
            }
        });

        // const responsePagesFilesPath = path.normalize(path.join(__dirname, '/../../../cf_errors/main/', props.env.environmentName, '/'));
        // const responsePagePathsByStatusCode: { [key: string]: string } = {};

        // if (fs.existsSync(responsePagesFilesPath)) {
        //     this.s3Deployment = new BucketDeployment(this, 'DeployErrorFiles', {
        //         sources: [Source.asset(responsePagesFilesPath)],
        //         destinationBucket: this.errorsBucket,
        //         destinationKeyPrefix: 'errors/',
        //     });

        //     const responsePageFilesPaths = fs.readdirSync(responsePagesFilesPath).filter(filename =>
        //         fs.lstatSync(path.join(responsePagesFilesPath, filename)).isFile()
        //     );

        //     responsePageFilesPaths.forEach(responsePageFilePath => {
        //         const responseCode = path.parse(responsePageFilePath).name;
        //         responsePagePathsByStatusCode[responseCode] = `/errors/${responsePageFilePath}`;
        //     });
        // }

        const tmCachePolicyProps: TmCachePolicyProps = {
            /** OPTIONAL CACHING PARAMETERS */
            // cachePolicyName: 'typo3-cache-policy',
            // cookieBehavior: CacheCookieBehavior,
            // headerBehavior: CacheHeaderBehavior,
            // queryStringBehavior: CacheQueryStringBehavior,
            // enableAcceptEncodingBrotli: true,
            // enableAcceptEncodingGzip: true,
            // defaultTtl: Duration,
            // maxTtl: Duration,
            // minTtl: Duration,
            // additionalCookies: string[],
            // additionalHeaders: string[];
            // additionalQueryStrings: string[];      

        };

        const defaultBehavior = {
            origin: this.loadBalancerOrigin,
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: AllowedMethods.ALLOW_ALL,
            cachePolicy: new TmCachePolicy(this, 'DefaultCachePolicy', tmCachePolicyProps),
        }

        this.distribution = new Distribution(this, 'CloudFrontDistribution', {
            domainNames: [props.domainName],
            certificate: this.certificate,
            logBucket: this.logBucket,
            priceClass: PriceClass.PRICE_CLASS_100,
            webAclId: props.webAclId,
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: defaultBehavior
            // errorResponses: Object.entries(responsePagePathsByStatusCode).map(([statusCode, responsePagePath]) => ({
            //     httpStatus: parseInt(statusCode),
            //     responsePagePath,
            //     ttl: Duration.seconds(props.errorCachingMinTtl || 30),
            // })),
        });

        this.distribution.addBehavior('/typo3/*', this.loadBalancerOrigin, {
            allowedMethods: AllowedMethods.ALLOW_ALL,
            cachePolicy: CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: props.viewerProtocolPolicy || ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        });

        this.distribution.addBehavior('/errors/*', this.errorsBucketOrigin, {
            viewerProtocolPolicy: props.viewerProtocolPolicy || ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        });

        this.distribution.addBehavior('/assets/*', this.loadBalancerOrigin, {
            viewerProtocolPolicy: props.viewerProtocolPolicy || ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        });

        new CfnOutput(this, 'DistributionID', {
            value: this.distribution.distributionId,
        });

    }

    // addEdgeLambdaFunction(id: string, behaviorPathPattern: string, codePath: string, handler: string) {
    //     const lambdaFunction = new Function(this, id, {
    //         runtime: Runtime.PYTHON_3_8,
    //         handler,
    //         code: Code.fromAsset(codePath),
    //     });

    //     this.distribution.addBehavior(behaviorPathPattern, this.loadBalancerOrigin, {
    //         viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //         edgeLambdas: [{
    //             eventType: LambdaEdgeEventType.VIEWER_REQUEST,
    //             functionVersion: lambdaFunction.currentVersion,
    //         }],
    //     });
    // }
}
