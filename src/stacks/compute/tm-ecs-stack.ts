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
import { importSecurityGroup, importVpc, originCustomHeaderValue, publishParameter, readParameter } from '../common/references';

/**
 * A field of a Secrets Manager secret passed to the containers.
 */
export interface TmSecretField {
  /**
   * SSM parameter holding the complete ARN of the secret.
   */
  readonly secretArnParameterName: string;

  /**
   * JSON field of the secret. Omit it to read the whole secret value (for a
   * single-value secret, e.g. a CDK-generated password stored as a raw string).
   *
   * @default - the whole secret value
   */
  readonly field?: string;
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
   * Docker build target stage of the `web` container.
   *
   * @default - the Dockerfile's last stage
   */
  readonly webBuildTarget?: string;

  /**
   * Docker build target stage of the `php-fpm` container.
   *
   * @default - the Dockerfile's last stage
   */
  readonly phpFpmBuildTarget?: string;

  /**
   * Prepends a `chown` of the EFS `typo3temp/assets` mount (uid/gid 33) to the
   * post-deploy hook command. Off by default so the hook command of existing
   * environments is unchanged.
   *
   * @default false
   */
  readonly fixEfsAssetsOwnership?: boolean;

  /**
   * SSM parameter holding the secret header value sent by CloudFront.
   */
  readonly originCustomHeaderParameterName: string;

  /**
   * Generates the CloudFront origin custom-header value instead of reading it
   * from a pre-seeded SSM parameter. When true, this stack derives a stable,
   * concrete literal (identical to the one `TmCloudfrontStack` uses, since both
   * derive it the same way) and publishes it to
   * `originCustomHeaderParameterName`, so no human seeds the parameter. When
   * false, the value is read from the parameter (which a human must seed).
   *
   * @default false
   */
  readonly generateOriginCustomHeader?: boolean;

  /**
   * SSM parameter holding the Solr security group ID. When set, the task is
   * allowed to reach the Solr instance on port 8983.
   *
   * @default - no Solr instance
   */
  readonly solrSecurityGroupIdParameterName?: string;

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
   * Variables whose value CDK generates once and stores in Secrets Manager,
   * never in the template. One secret is created per name; its complete ARN is
   * published to SSM at `/applications/<applicationName>/generated/<NAME>-arn`.
   * Use it for machine values no human sets (a TYPO3 encryption key, an
   * install-tool password).
   *
   * @default []
   */
  readonly generatedSecrets?: string[];

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

    // The secret header CloudFront sends and the ALB only-accept condition.
    // Generated: a stable concrete literal (used directly in the ALB listener
    // condition, which cannot take an unresolved reference) that this stack
    // also publishes to the shared parameter for TmCloudfrontStack to read.
    // Both stacks derive the identical value, so the ALB and CloudFront always
    // agree. Imported: read the pre-seeded parameter, as before.
    const originCustomHeader = props.generateOriginCustomHeader
      ? originCustomHeaderValue(this.account, env)
      : readParameter(this, props.originCustomHeaderParameterName);
    if (props.generateOriginCustomHeader) {
      publishParameter(this, 'OriginCustomHeaderParameter', props.originCustomHeaderParameterName, originCustomHeader);
    }

    const documentRoot = topology === ContainerTopology.NGINX_PHP_FPM ? '/app/html' : '/var/www/public';
    const efsVolumes: IIefsVolumes[] = [
      { name: 'assets', path: `${documentRoot}/typo3temp/assets` },
      ...(props.falEfsDirectories ?? []).map(directory => ({ name: directory, path: `${documentRoot}/${directory}` })),
    ];

    const cpu = props.cpu ?? 1024;
    const memoryLimitMiB = props.memoryLimitMiB ?? 2048;
    const twoContainers = topology !== ContainerTopology.SINGLE;
    const commandContainer = twoContainers ? 'php-fpm' : 'web';

    // The one-off post-deploy task runs on a container that mounts the EFS
    // `assets` volume. ECS creates the mount's intermediate directories as
    // root, so www-data (uid/gid 33) cannot write under them. When
    // `fixEfsAssetsOwnership` is set, the hook fixes the ownership of the EFS
    // mount (idempotent) before running the repository's deployment hook. Off
    // by default, so the hook command of existing environments is unchanged.
    const assetsPath = `${documentRoot}/typo3temp/assets`;
    const deploymentHookCommand = props.deploymentHookCommand ?? ['/usr/local/bin/deployment-hook.sh'];
    const deploymentHookWithChown = props.fixEfsAssetsOwnership
      ? [
        '/bin/sh',
        '-c',
        `chown -R 33:33 ${assetsPath} && exec ${deploymentHookCommand.map(shellQuote).join(' ')}`,
      ]
      : deploymentHookCommand;

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
      customHttpHeaderValue: originCustomHeader,
      secrets,
      buildContextPath: props.buildContextPath,
      buildDockerfile: props.webDockerfile,
      buildTarget: props.webBuildTarget,
      scheduledTasksCommand: props.scheduledTasksCommand ?? '/usr/local/bin/run-scheduler.sh',
      scheduledTaskContainerName: commandContainer,
      efsVolumes,
      ecsDeploymentHookProps: {
        containerName: commandContainer,
        command: deploymentHookWithChown,
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
    if (props.solrSecurityGroupIdParameterName) {
      const solrSecurityGroup = importSecurityGroup(this, 'SolrSecurityGroup', props.solrSecurityGroupIdParameterName);
      solrSecurityGroup.addIngressRule(serviceSecurityGroup, ec2.Port.tcp(8983), 'Allow from Fargate Service');
    }
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
      buildTarget: props.phpFpmBuildTarget,
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
      // With a field: read that JSON field. Without: read the whole secret
      // value (a single-value secret, e.g. a CDK-generated password).
      secrets[variable] = secretField.field
        ? ecs.Secret.fromSecretsManager(importedSecrets[parameterName], secretField.field)
        : ecs.Secret.fromSecretsManager(importedSecrets[parameterName]);
    }

    for (const name of props.generatedSecrets ?? []) {
      // CDK generates the value once, into Secrets Manager; it never appears in
      // the template. Punctuation is excluded so the value is safe as a plain
      // environment variable (no quoting surprises for the application).
      const generated = new secretsmanager.Secret(this, `${name}Generated`, {
        secretName: `/applications/${props.applicationName}/generated/${name}`,
        generateSecretString: {
          passwordLength: 64,
          excludePunctuation: true,
          includeSpace: false,
        },
      });
      secrets[name] = ecs.Secret.fromSecretsManager(generated);
      publishParameter(this, `${name}GeneratedArnParameter`,
        TmParameterNames.generatedSecretArn(props.applicationName, name), generated.secretArn);
    }

    return secrets;
  }
}

/**
 * Single-quotes a shell argument so the deployment hook command survives being
 * wrapped in `sh -c`. A command with no shell metacharacters is left as is.
 */
function shellQuote(argument: string): string {
  if (/^[A-Za-z0-9_./-]+$/.test(argument)) {
    return argument;
  }
  return `'${argument.replace(/'/g, "'\\''")}'`;
}
