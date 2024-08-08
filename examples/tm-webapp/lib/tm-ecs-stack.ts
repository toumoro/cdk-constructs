import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TmApplicationLoadBalancedFargateService, TmApplicationLoadBalancedFargateServiceProps } from '../../../src/containers/ecs/ecs-base-pattern';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AwsManagedPrefixList } from '../../../src/cdn/cloudfront/prefixList';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface TmEcsStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly allowPublicInternetAccess?: boolean;
  readonly listenToHttp?: boolean;
  readonly listenToHttps?: boolean;
  readonly memoryLimitMiB?: number;
  readonly cpu?: number;
  readonly desiredCount?: number;
  readonly containerPort?: number;
  readonly hostedZoneIdParameterName: string;
  readonly customHttpHeaderParameterName: string;
  readonly domainParameterName: string;
  readonly minTaskCount?: number;
  readonly maxTaskCount?: number;
  readonly secretsFromSsmParameterStore?: string[];
  readonly additionalSecretsFromParameterStore?: { [key: string]: string };
  readonly applicationName: string;
  readonly buildContextPath: string;
  readonly buildDockerfile: string;
}

export class TmEcsStack extends cdk.Stack {

  public readonly loadbalancer: elbv2.ILoadBalancerV2;
  public readonly cluster: ecs.ICluster;
  public readonly fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: TmEcsStackProps) {

    super(scope, id, props);

    // Get cloudFront prefixlist
    const cloudFrontPrefixListId = new AwsManagedPrefixList(this, 'CloudfrontOriginPrefixList', {
      name: 'com.amazonaws.global.cloudfront.origin-facing',
    }).prefixListId;

    // // Create a custom Security Group
    const lbSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'ALB Security Group',
    });

    lbSecurityGroup.addIngressRule(ec2.Peer.prefixList(cloudFrontPrefixListId), ec2.Port.tcp(443), 'Allow HTTPS from CloudFront');

    // const customHttpHeaderValue = ssm.StringParameter.valueForStringParameter(
    //   this, 'customHttpHeaderValue');
    // const domainName = ssm.StringParameter.valueForStringParameter(
    //   this, 'domainName');
    // const hostedZoneId = ssm.StringParameter.valueForStringParameter(
    //   this, 'hostedZoneId');

    // Image config
    const secretsFromSsmParameterStore: string[] = props.secretsFromSsmParameterStore || [];
    const additionalSecretsFromSsmParameterStore: { [key: string]: string } = props.additionalSecretsFromParameterStore || {};

    const environment_secrets: { [key: string]: ecs.Secret } = {};

    this.addEnvironmentSecrets(secretsFromSsmParameterStore, environment_secrets, props.applicationName);
    this.addAdditionalEnvironmentSecrets(additionalSecretsFromSsmParameterStore, environment_secrets);

    // /** Service Props*/
    // const patternsProps: TmApplicationLoadBalancedFargateServiceProps = {
    //   vpc: props.vpc,
    //   memoryLimitMiB: props.memoryLimitMiB,
    //   cpu: props.cpu,
    //   desiredCount: props.desiredCount,
    //   minTaskCount: props.minTaskCount,
    //   maxTaskCount: props.maxTaskCount,
    //   containerPort: props.containerPort,
    //   //customHttpHeaderValue: props.customHttpHeaderValue,
    //   customHttpHeaderValue: customHttpHeaderValue,
    //   buildContextPath: props.buildContextPath ?? './',
    //   buildDockerfile: props.buildDockerfile ?? 'Dockerfile',
    //   certificate: new acm.Certificate(this, 'Certificate', {
    //     domainName: domainName,
    //     validation: acm.CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this, 'HostedZone', hostedZoneId)),
    //   }),
    // }

    /** Service Props*/
    const patternsProps: TmApplicationLoadBalancedFargateServiceProps = {
      vpc: props.vpc,
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      desiredCount: props.desiredCount,
      minTaskCount: props.minTaskCount,
      maxTaskCount: props.maxTaskCount,
      containerPort: props.containerPort,
      secrets: environment_secrets,
      customHttpHeaderValue: ssm.StringParameter.valueForStringParameter(this, props.customHttpHeaderParameterName),
      certificate: new acm.Certificate(this, 'Certificate', {
        domainName: ssm.StringParameter.valueForStringParameter(this, props.domainParameterName),
        validation: acm.CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this, 'HostedZone', ssm.StringParameter.valueForStringParameter(this, props.hostedZoneIdParameterName))),
      }),
      buildContextPath: props.buildContextPath,
      buildDockerfile: props.buildDockerfile,
    }

    /** Service Pattern */
    const tmPatterns = new TmApplicationLoadBalancedFargateService(this, 'servicePattern', patternsProps);
    tmPatterns.loadBalancer.addSecurityGroup(lbSecurityGroup);

    tmPatterns.taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      resources: ["*"],
    }));

    this.loadbalancer = tmPatterns.loadBalancer;
    this.cluster = tmPatterns.cluster;
    this.fargateService = tmPatterns.service;
  }


  private addEnvironmentSecrets(secrets: string[], environmentSecrets: { [key: string]: ecs.Secret }, applicationName: string) {
    for (const secret of secrets) {
      const secretParameter = ssm.StringParameter.fromSecureStringParameterAttributes(this, `${secret}SSMParameter`, {
        parameterName: `/applications/${applicationName}/secrets/${secret}`,
      });
      environmentSecrets[secret] = ecs.Secret.fromSsmParameter(secretParameter);
    }
  }

  private addAdditionalEnvironmentSecrets(secrets: { [key: string]: string }, environmentSecrets: { [key: string]: ecs.Secret }) {
    Object.entries(secrets).forEach(([key, value]) => {
      const secretParameter = ssm.StringParameter.fromSecureStringParameterAttributes(this, `${key}SSMParameter`, {
        parameterName: `${value}`
      });
      environmentSecrets[`${key}`] = ecs.Secret.fromSsmParameter(secretParameter);
    })


  }
}