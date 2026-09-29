import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { TmEcsDeploymentHook } from './ecs-deployment-hook';
import { TmEfsFileSystem } from '../../storage/efs-filesystem';

export interface IIefsVolumes {
  name: string;
  path: string;
}

export interface IIEcsDeploymentHookProps {
  containerName: string;
  command: string[];
}

/**
 * Represents the configuration for an ecsPatterns.
 */

export interface TmApplicationLoadBalancedFargateServiceProps extends ecsPatterns.ApplicationLoadBalancedFargateServiceProps {

  /**
 * The number of cpu units used by the task.
 */
  //readonly vpc?: ec2.IVpc;

  /**
 * The number of cpu units used by the task.
 */
  //readonly cpu?: number;

  /**
 * The amount (in MiB) of memory used by the task.
 */
  //readonly memoryLimitMiB?: number;

  /**
 * The desired number of instantiations of the task definition to keep running on the service.
 */
  //readonly desiredCount?: number;

  /**
* The container port.
*/
  readonly containerPort?: number;

  /**
* The certificate .
*/
  //readonly certificate?: ICertificate;

  /**
* The listener port.
*/
  //readonly listenerPort?: number;

  /**
* The minumun number od tasks.
*/
  readonly minTaskCount?: number;

  /**
* The maximum number of task.
*/
  readonly maxTaskCount?: number;

  /**
* Custom http header value.
*/
  readonly customHttpHeaderValue?: string;
  /*
  * The build context path.
  */
  readonly buildContextPath: string;
  /*
  * The build dockerfile.
  */
  readonly buildDockerfile: string;
  /*
  * The build container args.
  */
  readonly buildContainerArgs?: { [key: string]: string };
  /*
  * The secrets to pass to the container.
  */
  readonly secrets?: { [key: string]: ecs.Secret };

  /*
  * The scheduled task schedule expression
  */
  readonly scheduledTaskScheduleExpression?: events.Schedule;
  /*
  * The scheduled task command
  */
  readonly scheduledTasksCommand?: string;

  /*
  * EFS Volumes
  */
  readonly efsVolumes?: IIefsVolumes[];

  /*
  * Deployment Hook Props
  */
  readonly ecsDeploymentHookProps?: IIEcsDeploymentHookProps;
  /*
  * targetCpuUtilizationPercent
  */
  readonly targetCpuUtilizationPercent?: number;
  /*
  * targetMemoryUtilizationPercent
  */
  readonly targetMemoryUtilizationPercent?: number;

  /**
   * The load balancing algorithm the target group uses to route requests to its
   * registered targets.
   *
   * @default TargetGroupLoadBalancingAlgorithmType.LEAST_OUTSTANDING_REQUESTS
   */
  readonly loadBalancingAlgorithmType?: elbv2.TargetGroupLoadBalancingAlgorithmType;

  /**
   * The health check configuration applied to the ALB target group.
   *
   * When omitted, the target group keeps the default health check provided by
   * the underlying `ApplicationLoadBalancedFargateService` (this preserves
   * backwards compatibility: the health check settings are only changed when
   * this property is explicitly passed).
   *
   * Note: this is the ELB *target group* health check
   * (`elbv2.HealthCheck`), distinct from the base class `healthCheck` prop
   * which configures the *container* health check (`ecs.HealthCheck`).
   *
   * @default - the default target group health check is used unchanged.
   */
  readonly targetGroupHealthCheck?: elbv2.HealthCheck;

  /**
   * The CloudWatch monitoring configuration applied to the ECS service, which
   * controls the resolution of the service-level `CPUUtilization` and
   * `MemoryUtilization` metrics.
   *
   * By default this construct enables high-resolution (20-second) collection of
   * the `CPUUtilization` metric, so that target-tracking auto scaling can react
   * faster. Pass this property to override that default entirely (e.g. to add
   * `MemoryUtilization`, or to fall back to the standard 60-second resolution).
   *
   * @default - { metricConfigurations: [{ metricNames: ['CPUUtilization'], resolutionSeconds: 20 }] }
   */
  readonly monitoringConfiguration?: ecs.CfnService.MonitoringConfigurationProperty;

  /**
   * Completely disable the built-in auto-scaling policies.
   *
   * By default this construct enables target-tracking auto scaling on both CPU
   * and memory utilization (targets from `targetCpuUtilizationPercent` /
   * `targetMemoryUtilizationPercent`, 60-second scale-in/scale-out cooldowns,
   * capacity from `minTaskCount` / `maxTaskCount`).
   *
   * Set this to `true` to skip those default policies entirely and take full
   * control of scaling yourself. The construct still creates the
   * `ScalableTaskCount` (with the `minTaskCount` / `maxTaskCount` capacity
   * bounds) and exposes it as {@link scalableTaskCount}, so you can attach any
   * scaling policy you want (custom CPU/memory targets, request-count scaling,
   * scheduled scaling, step scaling, ...) from your own stack.
   *
   * This keeps the current behavior as the default for everyone who does not
   * pass it, while allowing a complete override.
   *
   * @default false - the built-in CPU + memory target-tracking policies apply.
   */
  readonly disableDefaultScaling?: boolean;
}


export class TmApplicationLoadBalancedFargateService extends ecsPatterns.ApplicationLoadBalancedFargateService {

  /**
   * The scalable attribute representing the task count of the service.
   *
   * This is always created (with the `minTaskCount` / `maxTaskCount` capacity
   * bounds) regardless of `disableDefaultScaling`, so consumers can attach
   * their own scaling policies to it — especially when they set
   * `disableDefaultScaling: true` to fully override the built-in policies.
   */
  public readonly scalableTaskCount: ecs.ScalableTaskCount;

  constructor(scope: Construct, id: string, props: TmApplicationLoadBalancedFargateServiceProps) {

    const dockerImageAsset = new ecr_assets.DockerImageAsset(scope, 'ApplicationImage', {
      //directory: path.join(__dirname, '../build/'),
      //file: 'docker/Dockerfile',
      directory: props.buildContextPath,
      file: props.buildDockerfile,
      buildArgs: props.buildContainerArgs,
      followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
    });

    //const defautProps: TmApplicationLoadBalancedFargateServiceProps = {
    const defautProps: ecsPatterns.ApplicationLoadBalancedFargateServiceProps = {
      vpc: props.vpc,
      assignPublicIp: true,
      enableExecuteCommand: true,
      memoryLimitMiB: 2048,
      cpu: 1024,
      desiredCount: 2,
      //minTaskCount: 1,
      //maxTaskCount: 3,
      listenerPort: 443,
      openListener: false,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      targetProtocol: elbv2.ApplicationProtocol.HTTP,
      taskSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      //buildContextPath: props.buildContextPath,
      //buildDockerfile: props.buildDockerfile,
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset),
        containerPort: props.containerPort, // Optional: Specify the container port
        enableLogging: true,
        containerName: 'web',
        secrets: props.secrets,
      },
      circuitBreaker: { rollback: true },
    };

    // targetGroupHealthCheck is consumed by this construct (not by the base
    // ApplicationLoadBalancedFargateService), so remove it before delegating to
    // super to avoid any confusion with the base container-level healthCheck.
    const { targetGroupHealthCheck, ...basePropsForSuper } = { ...defautProps, ...props };
    const mergedProps = { ...defautProps, ...props };

    super(scope, id, basePropsForSuper);

    const taskDefinition = this.taskDefinition;

    mergedProps.efsVolumes?.forEach((volume) => {
      const efsVolume = new TmEfsFileSystem(this, `EfsVolume-${volume.name}`, {
        vpc: mergedProps.vpc!,
        uid: '33',
        gid: '33',
      });
      taskDefinition.addVolume({
        name: volume.name,
        efsVolumeConfiguration: {
          fileSystemId: efsVolume.efsFileSystem.fileSystemId,
          authorizationConfig: {
            accessPointId: efsVolume.efsAccessPoint.accessPointId,
          },
          transitEncryption: 'ENABLED',
        },
      });
      taskDefinition.defaultContainer?.addMountPoints({
        containerPath: volume.path,
        sourceVolume: volume.name,
        readOnly: false,
      });
      efsVolume.efsFileSystem.connections.allowDefaultPortFrom(this.service, 'Allow from ECS Service');
    });

    // Keep task definitions active to allow manual rollback from ECS console
    taskDefinition.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // Configure the target group load balancing algorithm. Defaults to
    // least outstanding requests, which routes new requests to the target
    // with the fewest in-flight requests.
    this.targetGroup.setAttribute(
      'load_balancing.algorithm.type',
      mergedProps.loadBalancingAlgorithmType || elbv2.TargetGroupLoadBalancingAlgorithmType.LEAST_OUTSTANDING_REQUESTS,
    );

    // Set the target group deregistration delay to 60 seconds. This is the new
    // default for all consumers (the ELB default is 300 seconds).
    this.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '60');

    // Enable high-resolution (20-second) collection of the service CPUUtilization
    // metric so target-tracking auto scaling reacts faster than with the ECS
    // default of 60-second resolution. This is the new default for all consumers
    // and is applied unconditionally, but can be overridden entirely via the
    // monitoringConfiguration prop (e.g. to add MemoryUtilization or revert to
    // 60-second resolution).
    const cfnService = this.service.node.defaultChild as ecs.CfnService;
    cfnService.monitoring = mergedProps.monitoringConfiguration ?? {
      metricConfigurations: [
        {
          metricNames: ['CPUUtilization'],
          resolutionSeconds: 20,
        },
      ],
    };

    // Configure the target group health check only when explicitly provided,
    // so existing consumers keep the default health check unchanged.
    if (targetGroupHealthCheck) {
      this.targetGroup.configureHealthCheck(targetGroupHealthCheck);
    }

    // Remove the default action by setting a new default action with conditions
    this.listener.addTargetGroups('HeaderConditionForward', {
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.httpHeader('X-Custom-Header', [mergedProps.customHttpHeaderValue || '']),
      ],
      targetGroups: [this.targetGroup],
    });

    // Add a default action to return an access denied response
    this.listener.addAction('DefaultAction', {
      action: elbv2.ListenerAction.fixedResponse(403, {
        contentType: 'text/plain',
        messageBody: 'Access Denied',
      }),
    });

    // Configure auto-scaling. The scalable task count is always created and
    // exposed via `this.scalableTaskCount` so consumers can attach their own
    // policies.
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: mergedProps.minTaskCount,
      maxCapacity: mergedProps.maxTaskCount || 30,
    });
    this.scalableTaskCount = scaling;

    if (mergedProps.disableDefaultScaling) {
      // The consumer takes full control of the scaling policies via
      // `this.scalableTaskCount`. The default CPU + memory target-tracking
      // policies below are NOT applied.
    } else {
      // Scale based on CPU utilization
      scaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: mergedProps.targetCpuUtilizationPercent || 30,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      // Scale based on Memory utilization
      scaling.scaleOnMemoryUtilization('MemoryScaling', {
        targetUtilizationPercent: mergedProps.targetMemoryUtilizationPercent || 30,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });
    }


    if (mergedProps.scheduledTasksCommand) {
      /**
       * Add the required permissions to the task role to allow the ECS task to be started by the scheduled task
       */
      const scheduledTaskRole = this.taskDefinition.taskRole as iam.Role;
      const servicePrincipalScheduledTaskRole = new iam.ServicePrincipal('events.amazonaws.com');

      scheduledTaskRole.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        principals: [servicePrincipalScheduledTaskRole],
      }));


      const schedulerTarget = new events_targets.EcsTask({
        cluster: this.cluster,
        taskDefinition: this.taskDefinition,
        containerOverrides: [{
          containerName: this.taskDefinition.defaultContainer!.containerName,
          command: mergedProps.scheduledTasksCommand.split(' '),
        }],
        role: scheduledTaskRole,
        taskCount: 1,
        securityGroups: this.service.connections.securityGroups,
        //subnetSelection: this.cluster.vpc.publicSubnets
      });

      const rule = new events.Rule(this, 'SchedulerRule', {
        schedule: mergedProps.scheduledTaskScheduleExpression || events.Schedule.expression('rate(1 minute)'),
        targets: [schedulerTarget],
      });

      const cfnRule = rule.node.defaultChild as events.CfnRule;
      cfnRule.addPropertyOverride('Targets.0.EcsParameters.EnableExecuteCommand', 'true');
      cfnRule.addPropertyOverride('Targets.0.EcsParameters.TagList', [
        { Key: 'type', Value: 'ecs-scheduled' },
        { Key: 'name', Value: id },
      ]);
    }

    // Add deployment hook if provided
    if (mergedProps.ecsDeploymentHookProps) {
      new TmEcsDeploymentHook(this, 'EcsDeploymentHook', {
        taskDefinition: this.taskDefinition,
        cluster: this.cluster,
        subnets: mergedProps.vpc!.publicSubnets,
        securityGroups: this.service.connections.securityGroups,
        containerName: mergedProps.ecsDeploymentHookProps.containerName,
        command: mergedProps.ecsDeploymentHookProps.command,
      });
    }
  };

}

