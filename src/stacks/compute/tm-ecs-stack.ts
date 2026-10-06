import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { AwsManagedPrefixList } from '../../cdn/cloudfront/prefixList';
import { ContainerTopology } from '../../config/enums';
import { TmParameterNames } from '../../config/parameter-names';
import {
  IIefsVolumes,
  TmApplicationLoadBalancedFargateService,
  TmApplicationLoadBalancedFargateServiceProps,
  TmPhpFpmContainerOptions,
  TmSharedVolume,
} from '../../containers/ecs/ecs-base-pattern';
import { importSecurityGroup, importVpc, publishParameter, readParameter } from '../common/references';

/**
 * A field of a Secrets Manager secret passed to the containers.
 */
export interface TmSecretField {
  /**
   * SSM parameter holding the complete ARN of the secret.
   */
  readonly secretArnParameterName: string;

  /**
   * JSON field of the secret.
   */
  readonly field: string;
}

/**
 * Props for `TmEcsStack`.
 */
export interface TmEcsStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * CIDR range of the VPC.
   */
  readonly vpcCidr: string;

  /**
   * Docker build context (the application repository).
   */
  readonly buildContextPath: string;

  /**
   * Container layout of the task.
   */
  readonly containerTopology: ContainerTopology;

  /**
   * Dockerfile of the `web` container, relative to the build context.
   */
  readonly webDockerfile: string;

  /**
   * Dockerfile of the `php-fpm` container. Required unless the topology is SINGLE.
   *
   * @default - none
   */
  readonly phpFpmDockerfile?: string;

  /**
   * SSM parameter holding the secret header value sent by CloudFront.
   */
  readonly originCustomHeaderParameterName: string;

  /**
   * Application name used in the secrets path `/applications/<name>/secrets/`.
   */
  readonly applicationName: string;

  /**
   * Variables read from `/applications/<applicationName>/secrets/<NAME>`.
   *
   * @default []
   */
  readonly secretsFromSsmParameterStore?: string[];

  /**
   * Variables read from other SSM parameters, as `{ VARIABLE: parameterName }`.
   *
   * @default {}
   */
  readonly additionalSecretsFromParameterStore?: { [variable: string]: string };

  /**
   * Variables read from Secrets Manager secret fields.
   *
   * @default {}
   */
  readonly secretsFromSecretsManager?: { [variable: string]: TmSecretField };

  /**
   * Plain environment variables.
   *
   * @default {}
   */
  readonly environment?: { [variable: string]: string };

  /**
   * FAL directories stored on EFS, relative to the document root.
   *
   * @default []
   */
  readonly falEfsDirectories?: string[];

  /**
   * Task CPU units.
   *
   * @default 1024
   */
  readonly cpu?: number;

  /**
   * Task memory in MiB.
   *
   * @default 2048
   */
  readonly memoryLimitMiB?: number;

  /**
   * Number of tasks when the service is created.
   *
   * @default 2
   */
  readonly desiredCount?: number;

  /**
   * Autoscaling lower bound.
   *
   * @default 1
   */
  readonly minTaskCount?: number;

  /**
   * Autoscaling upper bound.
   *
   * @default 30
   */
  readonly maxTaskCount?: number;

  /**
   * Target CPU utilization of the autoscaling policy.
   *
   * @default 30
   */
  readonly targetCpuUtilizationPercent?: number;

  /**
   * Target memory utilization of the autoscaling policy.
   *
   * @default 30
   */
  readonly targetMemoryUtilizationPercent?: number;

  /**
   * Command of the scheduled task (every minute).
   *
   * @default '/usr/local/bin/run-scheduler.sh'
   */
  readonly scheduledTasksCommand?: string;

  /**
   * Command run in a one-off task after each deployment.
   *
   * @default ['/usr/local/bin/deployment-hook.sh']
   */
  readonly deploymentHookCommand?: string[];
}

/**
 * Fargate service behind an application load balancer that only accepts
 * CloudFront requests carrying the secret header. Reaches RDS and Redis, and
 * mounts `typo3temp/assets` (plus the EFS FAL directories) from EFS, which the
 * bastion can reach too. Publishes the load balancer DNS name in SSM.
 */
export class TmEcsStack extends cdk.Stack {
  /** The application load balancer. */
  public readonly loadbalancer: elbv2.ILoadBalancerV2;
  /** The ECS cluster. */
  public readonly cluster: ecs.ICluster;
  /** The Fargate service. */
  public readonly fargateService: ecs.FargateService;
  /** The service pattern. */
  public readonly service: TmApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: TmEcsStackProps) {
    super(scope, id, props);

    const env = props.environmentName;
    const topology = props.containerTopology;
    const vpc = importVpc(this, 'Vpc', env, props.vpcCidr, [ec2.SubnetType.PUBLIC, ec2.SubnetType.PRIVATE_WITH_EGRESS]);
    const rdsSecurityGroup = importSecurityGroup(this, 'RdsSecurityGroup', TmParameterNames.rdsSecurityGroupId(env));
    const redisSecurityGroup = importSecurityGroup(this, 'RedisSecurityGroup', TmParameterNames.redisSecurityGroupId(env));
    const bastionSecurityGroup = importSecurityGroup(this, 'BastionSecurityGroup', TmParameterNames.bastionSecurityGroupId(env));

    const cloudFrontPrefixListId = new AwsManagedPrefixList(this, 'CloudfrontOriginPrefixList', {
      name: 'com.amazonaws.global.cloudfront.origin-facing',
    }).prefixListId;

    const lbSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'ALB Security Group',
    });
    // The description is the fleet's (deployed) one, although the port is HTTP.
    lbSecurityGroup.addIngressRule(ec2.Peer.prefixList(cloudFrontPrefixListId), ec2.Port.tcp(80), 'Allow HTTPS from CloudFront');

    const secrets = this.buildSecrets(props);

    const documentRoot = topology === ContainerTopology.NGINX_PHP_FPM ? '/app/html' : '/var/www/public';
    const efsVolumes: IIefsVolumes[] = [
      { name: 'assets', path: `${documentRoot}/typo3temp/assets` },
      ...(props.falEfsDirectories ?? []).map(directory => ({ name: directory, path: `${documentRoot}/${directory}` })),
    ];

    const cpu = props.cpu ?? 1024;
    const memoryLimitMiB = props.memoryLimitMiB ?? 2048;
    const twoContainers = topology !== ContainerTopology.SINGLE;
    const commandContainer = twoContainers ? 'php-fpm' : 'web';

    const patternsProps: TmApplicationLoadBalancedFargateServiceProps = {
      vpc,
      cpu,
      memoryLimitMiB,
      desiredCount: props.desiredCount,
      minTaskCount: props.minTaskCount,
      maxTaskCount: props.maxTaskCount,
      targetCpuUtilizationPercent: props.targetCpuUtilizationPercent,
      targetMemoryUtilizationPercent: props.targetMemoryUtilizationPercent,
      // CloudFront reaches the load balancer over HTTP.
      listenerPort: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetProtocol: elbv2.ApplicationProtocol.HTTP,
      customHttpHeaderValue: readParameter(this, props.originCustomHeaderParameterName),
      secrets,
      buildContextPath: props.buildContextPath,
      buildDockerfile: props.webDockerfile,
      scheduledTasksCommand: props.scheduledTasksCommand ?? '/usr/local/bin/run-scheduler.sh',
      scheduledTaskContainerName: commandContainer,
      efsVolumes,
      ecsDeploymentHookProps: {
        containerName: commandContainer,
        command: props.deploymentHookCommand ?? ['/usr/local/bin/deployment-hook.sh'],
      },
      ...(twoContainers ? this.phpFpmProps(props, cpu, memoryLimitMiB) : {}),
    };

    this.service = new TmApplicationLoadBalancedFargateService(this, 'servicePattern', patternsProps);
    this.service.loadBalancer.addSecurityGroup(lbSecurityGroup);
    for (const [variable, value] of Object.entries(props.environment ?? {})) {
      this.service.taskDefinition.defaultContainer!.addEnvironment(variable, value);
    }

    this.service.taskDefinition.addToExecutionRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    const serviceSecurityGroup = this.service.service.connections.securityGroups[0];
    rdsSecurityGroup.addIngressRule(serviceSecurityGroup, ec2.Port.tcp(3306), 'Allow from Fargate Service');
    redisSecurityGroup.addIngressRule(serviceSecurityGroup, ec2.Port.tcp(6379), 'Allow from Fargate Service');
    this.service.efsFileSystems.forEach(fileSystem => fileSystem.connections.allowDefaultPortFrom(bastionSecurityGroup, 'Allow from bastion'));

    this.loadbalancer = this.service.loadBalancer;
    this.cluster = this.service.cluster;
    this.fargateService = this.service.service;

    publishParameter(this, 'LoadBalancerDnsNameParameter',
      TmParameterNames.ecsLoadBalancerDnsName(env), this.service.loadBalancer.loadBalancerDnsName);
  }

  /**
   * Props of the php-fpm container. The web container gets a quarter of the
   * CPU and a fifth of the memory, php-fpm the rest.
   */
  private phpFpmProps(props: TmEcsStackProps, cpu: number, memoryLimitMiB: number) {
    if (!props.phpFpmDockerfile) {
      throw new Error(`The ${props.containerTopology} topology needs phpFpmDockerfile.`);
    }
    const webCpu = Math.floor(cpu * 0.25);
    const webMemoryLimitMiB = Math.floor(memoryLimitMiB * 0.20);
    const fpmMemoryLimitMiB = memoryLimitMiB - webMemoryLimitMiB;

    const phpFpmContainer: TmPhpFpmContainerOptions = {
      buildContextPath: props.buildContextPath,
      buildDockerfile: props.phpFpmDockerfile,
      cpu: cpu - webCpu,
      memoryLimitMiB: fpmMemoryLimitMiB,
      environment: {
        ...props.environment,
        // tm-php-fpm sizes its worker pool from this value.
        TM_PHP_FPM_TOTAL_RAM_MB: String(fpmMemoryLimitMiB),
      },
    };

    if (props.containerTopology !== ContainerTopology.APACHE_PHP_FPM) {
      return { containerCpu: webCpu, containerMemoryLimitMiB: webMemoryLimitMiB, phpFpmContainer };
    }

    // tm-php-fpm creates a mkcert CA in /mnt/shared-ca and tm-apache waits for
    // it before generating its certificate, like in docker-compose.
    const sharedVolumes: TmSharedVolume[] = [{ name: 'shared-ca', path: '/mnt/shared-ca' }];

    // tm-apache proxies PHP requests to `php-fpm:9000`. On Fargate the
    // containers share localhost, but container names don't resolve, so the
    // name is mapped to 127.0.0.1 before tm-apache's own start script runs.
    return {
      containerCpu: webCpu,
      containerMemoryLimitMiB: webMemoryLimitMiB,
      phpFpmContainer,
      sharedVolumes,
      containerEntryPoint: ['/bin/sh', '-c'],
      containerCommand: ['echo "127.0.0.1 php-fpm" >> /etc/hosts && exec /usr/local/bin/run.sh'],
    };
  }

  private buildSecrets(props: TmEcsStackProps): { [variable: string]: ecs.Secret } {
    const secrets: { [variable: string]: ecs.Secret } = {};

    for (const name of props.secretsFromSsmParameterStore ?? []) {
      const parameter = ssm.StringParameter.fromSecureStringParameterAttributes(this, `${name}SSMParameter`, {
        parameterName: `/applications/${props.applicationName}/secrets/${name}`,
      });
      secrets[name] = ecs.Secret.fromSsmParameter(parameter);
    }

    for (const [variable, parameterName] of Object.entries(props.additionalSecretsFromParameterStore ?? {})) {
      const parameter = ssm.StringParameter.fromSecureStringParameterAttributes(this, `${variable}SSMParameter`, {
        parameterName,
      });
      secrets[variable] = ecs.Secret.fromSsmParameter(parameter);
    }

    const importedSecrets: { [parameterName: string]: secretsmanager.ISecret } = {};
    for (const [variable, secretField] of Object.entries(props.secretsFromSecretsManager ?? {})) {
      const parameterName = secretField.secretArnParameterName;
      importedSecrets[parameterName] ??= secretsmanager.Secret.fromSecretCompleteArn(
        this, `${variable}Secret`, readParameter(this, parameterName));
      secrets[variable] = ecs.Secret.fromSecretsManager(importedSecrets[parameterName], secretField.field);
    }

    return secrets;
  }
}
