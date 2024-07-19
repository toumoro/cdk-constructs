import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnOutput, Environment, RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { HttpOrigin, LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ILoadBalancerV2 } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { TmCachePolicy, TmCachePolicyProps } from '../../../src/cdn/cloudfront/cachePolicy';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as fs from 'fs';
import * as path from 'path';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface TmCloudfrontStackProps extends cdk.StackProps {
    //readonly originDnsName: string;
    readonly domainName: string;
    readonly hostedZoneId: string;
    readonly env?: Environment;
    readonly additionalCookies?: string[];
    readonly retainLogBuckets?: boolean;
    readonly webAclId?: string;
    readonly errorCachingMinTtl?: number;
    readonly applicationLoadbalancer1: ILoadBalancerV2;
    readonly applicationLoadbalancer2?: ILoadBalancerV2;
    readonly loadBalancerOriginProtocol?: cloudfront.OriginProtocolPolicy;
    readonly viewerProtocolPolicy?: cloudfront.ViewerProtocolPolicy;
    readonly customHttpHeaderValue?: string;
}

export class TmCloudfrontStack extends cdk.Stack {

    private certificate: Certificate;
    private logBucket: Bucket;
    // private errorsBucket: Bucket;
    // private errorsBucketOrigin: S3Origin;
    //private assetsBucketOrigin: HttpOrigin;
    private loadBalancerOrigin1: HttpOrigin;
    //private loadBalancerOrigin2: HttpOrigin;
    private distribution: cloudfront.Distribution;
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

        const authFunctionCode = fs.readFileSync(path.join(__dirname, 'cloudfront', 'basic-auth-function.js'), 'utf8');

        // CloudFront Function
        const authFunction = new cloudfront.Function(this, 'BasicAuthFunction', {
            functionName: 'BasicAuthFunction',
            code: cloudfront.FunctionCode.fromInline(authFunctionCode),
        });

        this.loadBalancerOrigin1 = new LoadBalancerV2Origin(props.applicationLoadbalancer1, {
            protocolPolicy: props.loadBalancerOriginProtocol || cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: {
                'X-Custom-Header': props.customHttpHeaderValue || '',
            }
        });

        /*
        this.loadBalancerOrigin2 = new LoadBalancerV2Origin(props.applicationLoadbalancer2, {
            protocolPolicy: props.loadBalancerOriginProtocol || cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: {
                'X-Custom-Header': props.customHttpHeaderValue || '',
            }
        });
        */
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
            origin: this.loadBalancerOrigin1,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: new TmCachePolicy(this, 'DefaultCachePolicy', tmCachePolicyProps),
            functionAssociations: [{
                function: authFunction,
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
              }],
        }

        this.distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
            domainNames: [props.domainName],
            certificate: this.certificate,
            logBucket: this.logBucket,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            webAclId: props.webAclId,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            defaultBehavior: defaultBehavior,
        });

        this.distribution.addBehavior('/typo3/*', this.loadBalancerOrigin1, {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            viewerProtocolPolicy: props.viewerProtocolPolicy || cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
            // functionAssociations: [{
            //     function: authFunction,
            //     eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            //   }],
        });


        new CfnOutput(this, 'DistributionID', {
            value: this.distribution.distributionId,
        });

    }

}