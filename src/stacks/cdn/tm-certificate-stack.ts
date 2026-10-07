import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/**
 * A certificate to create: the primary domain, its optional subject
 * alternative names, and the SSM parameter (in the application region) where
 * the created ARN is published for the CloudFront stacks to read.
 */
export interface TmCertificateRequest {
  /** Primary domain, e.g. `www.example.com`. */
  readonly domainName: string;

  /**
   * Subject alternative names covered by the same certificate.
   *
   * @default []
   */
  readonly subjectAlternativeNames?: string[];

  /**
   * Name of the SSM parameter (in `parameterRegion`) where the certificate ARN
   * is published. Must be the parameter the CloudFront stack reads, i.e.
   * `TmParameterNames.cloudfrontWwwCertificateArn` or
   * `cloudfrontCdnCertificateArn`.
   */
  readonly parameterName: string;

  /** Construct-id infix, unique within the stack (e.g. `Www0`, `Cdn`). */
  readonly idInfix: string;
}

/**
 * Props for `TmCertificateStack`.
 */
export interface TmCertificateStackProps extends cdk.StackProps {
  /**
   * Region where the certificate ARNs are published in SSM (the application
   * region, where the CloudFront stacks read them). The stack itself must be
   * deployed in us-east-1, as CloudFront requires.
   */
  readonly parameterRegion: string;

  /**
   * Certificates to create, one per CloudFront distribution.
   */
  readonly certificates: TmCertificateRequest[];
}

/**
 * Creates the ACM certificates (us-east-1) of the CloudFront distributions,
 * each with MANUAL DNS validation (`acm.CertificateValidation.fromDns()` with
 * no hosted zone), and publishes each ARN to the SSM parameter the matching
 * CloudFront stack already reads — in the application region, since SSM
 * parameters are regional.
 *
 * Manual validation is required because the domains live on Cloudflare, not
 * Route 53: CDK creates the certificate and emits the validation CNAME (as a
 * `CfnOutput`, also visible in the ACM console), which must be added once in
 * Cloudflare. ACM managed renewal reuses the same CNAME, so it is a one-time
 * seed; when the CNAME already exists, validation completes immediately on
 * deploy. The created path and the import-by-ARN path converge on the same
 * read-by-ARN code in the CloudFront stacks, which barely change.
 *
 * Must be deployed in us-east-1 (CloudFront rejects a certificate created in
 * any other region).
 */
export class TmCertificateStack extends cdk.Stack {
  /** The created certificates, in the order of `props.certificates`. */
  public readonly certificates: acm.Certificate[];

  constructor(scope: Construct, id: string, props: TmCertificateStackProps) {
    super(scope, id, props);

    this.certificates = [];

    for (const request of props.certificates) {
      const certificate = new acm.Certificate(this, `Certificate${request.idInfix}`, {
        domainName: request.domainName,
        subjectAlternativeNames: request.subjectAlternativeNames,
        // No hosted zone: manual DNS validation. CDK creates the certificate
        // and the CNAME is added out of band (Cloudflare). The existing CNAME
        // makes validation immediate on deploy.
        validation: acm.CertificateValidation.fromDns(),
      });
      certificate.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
      this.certificates.push(certificate);

      // SSM parameters are regional: publish the ARN in the application region,
      // where the CloudFront stacks read it. Same cross-region publish pattern
      // as TmWafStack's WebACL ARN.
      const putParameter: cr.AwsSdkCall = {
        service: '@aws-sdk/client-ssm',
        action: 'PutParameterCommand',
        parameters: { Name: request.parameterName, Value: certificate.certificateArn, Type: 'String', Overwrite: true },
        region: props.parameterRegion,
        physicalResourceId: cr.PhysicalResourceId.of(request.parameterName),
      };
      new cr.AwsCustomResource(this, `CertificateArnParameter${request.idInfix}`, {
        onCreate: putParameter,
        onUpdate: putParameter,
        onDelete: {
          service: '@aws-sdk/client-ssm',
          action: 'DeleteParameterCommand',
          parameters: { Name: request.parameterName },
          region: props.parameterRegion,
          ignoreErrorCodesMatching: 'ParameterNotFound',
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
            resources: [`arn:${this.partition}:ssm:${props.parameterRegion}:${this.account}:parameter${request.parameterName}`],
          }),
        ]),
        installLatestAwsSdk: false,
      });

      // The validation CNAME to add in Cloudflare (one-time seed; reused by ACM
      // managed renewal). Also visible in the ACM console.
      new cdk.CfnOutput(this, `CertificateArn${request.idInfix}`, { value: certificate.certificateArn });
    }
  }
}
