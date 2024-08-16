import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnOutput, Environment } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

export interface TmCloudfrontCdnStackProps extends cdk.StackProps {
    readonly hostedZoneIdParameterName: string;
    readonly env: Environment;
    readonly domainParameterName: string;
    readonly errorBuckets: s3.Bucket[];
    readonly contentBuckets: s3.Bucket[];
}

export class TmCloudfrontCdnStack extends cdk.Stack {

    private certificate: Certificate;
    private errorsBucketOrigins: S3Origin[] = [];
    private contentBucketOrigins: S3Origin[] = [];
    private distribution: cloudfront.Distribution;


    constructor(scope: Construct, id: string, props: TmCloudfrontCdnStackProps) {

        super(scope, id, props);

        this.certificate = new Certificate(this, 'Certificate', {
            domainName: ssm.StringParameter.valueForStringParameter(this, props.domainParameterName),
            validation: CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this,
                'HostedZoneId',
                ssm.StringParameter.valueForStringParameter(this, props.hostedZoneIdParameterName)
            ),
            )
        });

        //  S3 Origins
        for (const errorBucket of props.errorBuckets) {
            const errorBucketOrgin = new S3Origin(errorBucket);
            this.errorsBucketOrigins.push(errorBucketOrgin);
        }
        for (const contentBucket of props.contentBuckets) {
            const contentBucketOrgin = new S3Origin(contentBucket);
            this.contentBucketOrigins.push(contentBucketOrgin);
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

        // Default Behavior
        const defaultBehavior: cloudfront.BehaviorOptions = {
            origin: this.contentBucketOrigins[0],
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        }

        // Distribution
        this.distribution = new cloudfront.Distribution(this, 'CloudFrontCdnDistribution', {
            domainNames: [ssm.StringParameter.valueForStringParameter(this, props.domainParameterName)],
            certificate: this.certificate,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            errorResponses: errorResponsesObjects,
            defaultBehavior: defaultBehavior,
        });

        // Add additional behaviors for backup regions
        this.contentBucketOrigins.slice(1).forEach((origin, index) => {
            this.distribution.addBehavior(`/cdn-backup-region-${index + 1}/*`, origin, {
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            });
        });

        this.distribution.addBehavior('/errors/*', this.errorsBucketOrigins[0], {
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        });

        // Add additional behaviors for backup regions
        this.errorsBucketOrigins.slice(1).forEach((origin, index) => {
            this.distribution.addBehavior(`/errors-backup-region-${index + 1}/*`, origin, {
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            });
        });

        new CfnOutput(this, 'DistributionID', {
            value: this.distribution.distributionId,
        });
    }
}

