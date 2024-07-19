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


export interface TmEcsStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly allowPublicInternetAccess?: boolean;
  readonly listenToHttp?: boolean;
  readonly listenToHttps?: boolean;
  readonly memoryLimitMiB?: number;
  readonly cpu?: number;
  readonly desiredCount?: number;
  readonly containerPort?: number;
  readonly domainName: string;

  readonly hostedZoneId: string;
  readonly minTaskCount?: number;
  readonly maxTaskCount?: number;
  readonly customHttpHeaderValue?: string;
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

    /** Service Props*/
    const patternsProps: TmApplicationLoadBalancedFargateServiceProps = {
      vpc: props.vpc,
      memoryLimitMiB: props.memoryLimitMiB,
      cpu: props.cpu,
      desiredCount: props.desiredCount,
      minTaskCount: props.minTaskCount,
      maxTaskCount: props.maxTaskCount,
      containerPort: props.containerPort,
      customHttpHeaderValue: props.customHttpHeaderValue,
      certificate: new acm.Certificate(this, 'Certificate', {
        domainName: props.domainName,
        validation: acm.CertificateValidation.fromDns(HostedZone.fromHostedZoneId(this, 'HostedZone', props.hostedZoneId)),
      }),
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
}