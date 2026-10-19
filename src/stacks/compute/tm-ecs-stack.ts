import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { AwsManagedPrefixList } from '../../cdn/cloudfront/prefixList';
import { ContainerTopology } from '../../config/enums';
import { EcsHealthCheckSettings } from '../../config/environment-parameters';
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
   * Fronts the service with an INTERNAL load balancer meant for a CloudFront
   * VPC origin: private subnets, HTTPS listener on 443 with an ACM certificate
   * for `loadBalancerDomains` (DNS validation), ingress from the VPC only. The
   * load balancer ARN is published in SSM for `TmCloudfrontStack`. When
   * false, the load balancer is public and listens on HTTP 80 for the
   * CloudFront origin-facing prefix list.
   *
   * @default false
   */
  readonly vpcOrigin?: boolean;

  /**
   * Adds a second, internal HTTPS load balancer ("bridge") on the same
   * service. While `vpcOrigin` is false it is published as the VPC origin
   * endpoint, which lets CloudFront move off the public load balancer before
   * that one is replaced. See `CloudfrontSettings.vpcOriginBridge`.
   *
   * @default false
   */
  readonly vpcOriginBridge?: boolean;

  /**
   * Domains of the certificate attached to the HTTPS listeners (the www
   * domains CloudFront forwards in the `Host` header). Required with
   * `vpcOrigin` or `vpcOriginBridge`.
   *
   * @default - none
   */
  readonly loadBalancerDomains?: string[];

  /**
   * SSM parameter holding the name of a bucket the TASK ROLE may read and
   * write (FAL on S3 through the AWS SDK default credential chain, without a
   * service user and access keys).
   *
   * @default - the task role gets no bucket access
   */
  readonly taskRoleBucketNameParameterName?: string;

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
   * Drops the memory target-tracking policy (CPU only).
   *
   * @default false
   */
  readonly disableMemoryScaling?: boolean;

  /**
   * Runs the tasks in the private subnets with egress, without a public IP.
   *
   * @default false - public subnets with a public IP
   */
  readonly tasksInPrivateSubnets?: boolean;

  /**
   * Health check of the target group(s), see `EcsHealthCheckSettings`.
   *
   * @default - ELB defaults
   */
  readonly healthCheck?: EcsHealthCheckSettings;

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
    const vpcOrigin = props.vpcOrigin ?? false;
    const bridge = props.vpcOriginBridge ?? false;
    const privateTasks = props.tasksInPrivateSubnets ?? false;
    // The private subnets are always used (scheduled task, and the internal
    // load balancer, bridge or private tasks when enabled); the public ones
    // only by a public load balancer or public tasks.
    const subnetTypes = [ec2.SubnetType.PRIVATE_WITH_EGRESS];
    if (!vpcOrigin || !privateTasks) {
      subnetTypes.unshift(ec2.SubnetType.PUBLIC);
    }
    const vpc = importVpc(this, 'Vpc', env, props.vpcCidr, subnetTypes);
    const rdsSecurityGroup = importSecurityGroup(this, 'RdsSecurityGroup', TmParameterNames.rdsSecurityGroupId(env));
    const redisSecurityGroup = importSecurityGroup(this, 'RedisSecurityGroup', TmParameterNames.redisSecurityGroupId(env));
    const bastionSecurityGroup = importSecurityGroup(this, 'BastionSecurityGroup', TmParameterNames.bastionSecurityGroupId(env));

    const lbSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'ALB Security Group',
    });
    if (vpcOrigin) {
      // Internal load balancer: CloudFront reaches it through the VPC origin's
      // elastic network interfaces, which carry VPC addresses.
      lbSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'Allow HTTPS from the CloudFront VPC origin');
    } else {
      const cloudFrontPrefixListId = new AwsManagedPrefixList(this, 'CloudfrontOriginPrefixList', {
        name: 'com.amazonaws.global.cloudfront.origin-facing',
      }).prefixListId;
      // The description is the fleet's (deployed) one, although the port is HTTP.
      lbSecurityGroup.addIngressRule(ec2.Peer.prefixList(cloudFrontPrefixListId), ec2.Port.tcp(80), 'Allow HTTPS from CloudFront');
    }

    // VPC origin: the listener terminates TLS with a certificate for the www
    // domains (CloudFront forwards the viewer's Host header, which the
    // certificate must cover). DNS validation reuses the CNAME ACM already
    // issued for the same domains in us-east-1, so it completes on its own.
    let listenerCertificate: acm.ICertificate | undefined;
    if (vpcOrigin || bridge) {
      const domains = props.loadBalancerDomains ?? [];
      if (domains.length === 0) {
        throw new Error('vpcOrigin and vpcOriginBridge require loadBalancerDomains (the domains of the HTTPS listener certificate).');
      }
      const certificate = new acm.Certificate(this, 'LoadBalancerCertificate', {
        domainName: domains[0],
        subjectAlternativeNames: domains.slice(1),
        validation: acm.CertificateValidation.fromDns(),
      });
      certificate.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
      listenerCertificate = certificate;
    }

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
    const targetGroupHealthCheck = healthCheck(props.healthCheck);
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
      disableMemoryScaling: props.disableMemoryScaling,
      ...(privateTasks ? { taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }, assignPublicIp: false } : {}),
      targetGroupHealthCheck,
      // VPC origin: internal load balancer, HTTPS 443. Otherwise CloudFront
      // reaches the public load balancer over HTTP 80.
      ...(vpcOrigin
        ? {
          publicLoadBalancer: false,
          listenerPort: 443,
          protocol: elbv2.ApplicationProtocol.HTTPS,
          certificate: listenerCertificate,
          sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
        }
        : {
          listenerPort: 80,
          protocol: elbv2.ApplicationProtocol.HTTP,
        }),
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

    // The bridge: a second internal HTTPS load balancer on the same service,
    // with the same certificate and the same origin-header rule. ECS registers
    // the tasks in both target groups.
    let bridgeLoadBalancer: elbv2.ApplicationLoadBalancer | undefined;
    if (bridge) {
      const bridgeSecurityGroup = new ec2.SecurityGroup(this, 'VpcOriginBridgeSecurityGroup', {
        vpc,
        allowAllOutbound: true,
        description: 'VPC origin bridge load balancer',
      });
      bridgeSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'Allow HTTPS from the CloudFront VPC origin');
      bridgeLoadBalancer = new elbv2.ApplicationLoadBalancer(this, 'VpcOriginBridge', {
        vpc,
        internetFacing: false,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroup: bridgeSecurityGroup,
      });
      const bridgeListener = bridgeLoadBalancer.addListener('Https', {
        port: 443,
        certificates: [listenerCertificate!],
        sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
        defaultAction: elbv2.ListenerAction.fixedResponse(403, { contentType: 'text/plain', messageBody: 'Access Denied' }),
      });
      bridgeListener.addTargets('Service', {
        priority: 1,
        conditions: [elbv2.ListenerCondition.httpHeader('X-Custom-Header', [originCustomHeader])],
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [this.service.service],
        deregistrationDelay: cdk.Duration.seconds(60),
        healthCheck: targetGroupHealthCheck,
      });
    }

    // What TmCloudfrontStack builds its VPC origin endpoint from: the service's
    // own load balancer once internal, the bridge until then.
    const vpcOriginLoadBalancer = vpcOrigin ? this.service.loadBalancer : bridgeLoadBalancer;
    if (vpcOriginLoadBalancer) {
      publishParameter(this, 'VpcOriginLoadBalancerArnParameter',
        TmParameterNames.ecsVpcOriginLoadBalancerArn(env), vpcOriginLoadBalancer.loadBalancerArn);
      publishParameter(this, 'VpcOriginLoadBalancerDnsNameParameter',
        TmParameterNames.ecsVpcOriginLoadBalancerDnsName(env), vpcOriginLoadBalancer.loadBalancerDnsName);
    }

    if (props.taskRoleBucketNameParameterName) {
      const bucket = s3.Bucket.fromBucketName(this, 'TaskRoleBucket', readParameter(this, props.taskRoleBucketNameParameterName));
      bucket.grantReadWrite(this.service.taskDefinition.taskRole);
    }
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
 * The ELB health check for the settings, or undefined (ELB defaults) when none.
 */
function healthCheck(settings?: EcsHealthCheckSettings): elbv2.HealthCheck | undefined {
  if (!settings) {
    return undefined;
  }
  return {
    path: settings.path,
    healthyHttpCodes: settings.healthyHttpCodes,
    interval: settings.intervalSeconds !== undefined ? cdk.Duration.seconds(settings.intervalSeconds) : undefined,
    timeout: settings.timeoutSeconds !== undefined ? cdk.Duration.seconds(settings.timeoutSeconds) : undefined,
    healthyThresholdCount: settings.healthyThresholdCount,
    unhealthyThresholdCount: settings.unhealthyThresholdCount,
  };
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
