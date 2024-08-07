import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TmApplicationLoadBalancedFargateService, TmApplicationLoadBalancedFargateServiceProps } from './ecs/ecs-base-pattern';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AwsManagedPrefixList } from './cloudfront/prefixList';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { ApplicationLoadBalancedTaskImageOptions } from 'aws-cdk-lib/aws-ecs-patterns';


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
  readonly secrets_from_ssm_parameter_store?: string[];
  readonly additional_secrets_from_parameter_store?: { [key: string]: string };
  readonly application_name: string;
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

    // Image config
    const secrets_from_ssm_parameter_store: string[] = props.secrets_from_ssm_parameter_store || [];
    const additional_secrets_from_ssm_parameter_store: { [key: string]: string } = props.additional_secrets_from_parameter_store || {};

    const environment_secrets: { [key: string]: ecs.Secret } = {};

    this.addEnvironmentSecrets(secrets_from_ssm_parameter_store, environment_secrets, props.application_name);
    this.addAdditionalEnvironmentSecrets(additional_secrets_from_ssm_parameter_store, environment_secrets);

    const imageOptions: ApplicationLoadBalancedTaskImageOptions = {
      image: ecs.ContainerImage.fromAsset('lib/ecs/containerImage'),
      containerPort: props.containerPort, // Optional: Specify the container port
      enableLogging: true,
      containerName: 'web',
      secrets: environment_secrets
    }


    /** Service Props*/
    const patternsProps: TmApplicationLoadBalancedFargateServiceProps = {
      vpc: props.vpc,
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      desiredCount: props.desiredCount,
      minTaskCount: props.minTaskCount,
      maxTaskCount: props.maxTaskCount,
      containerPort: props.containerPort,
      customHttpHeaderValue: ssm.StringParameter.valueForStringParameter(this, props.customHttpHeaderParameterName),
      certificate: new acm.Certificate(this, 'Certificate', {
        domainName: ssm.StringParameter.valueForStringParameter(this, props.domainParameterName),
        validation: acm.CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this, 'HostedZone', ssm.StringParameter.valueForStringParameter(this, props.hostedZoneIdParameterName))),
      }),
      taskImageOptions: imageOptions
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

  private addEnvironmentSecrets(secrets: string[], environmentSecrets: { [key: string]: ecs.Secret }, application_name: string) {
    for (const secret of secrets) {
      const secretParameter = ssm.StringParameter.fromSecureStringParameterAttributes(this, `${secret}SSMParameter`, {
        parameterName: `/applications/${application_name}/secrets/${secret}`,
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
