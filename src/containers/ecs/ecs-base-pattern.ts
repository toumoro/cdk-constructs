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
import { TmEfsFileSystem } from '../../storage/efs-filesystem';

export interface IIefsVolumes {
  name: string;
  path: string;
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
}


export class TmApplicationLoadBalancedFargateService extends ecsPatterns.ApplicationLoadBalancedFargateService {

  constructor(scope: Construct, id: string, props: TmApplicationLoadBalancedFargateServiceProps) {

    const dockerImageAsset = new ecr_assets.DockerImageAsset(scope, 'ApplicationImage', {
      //directory: path.join(__dirname, '../build/'),
      //file: 'docker/Dockerfile',
      directory: props.buildContextPath,
      file: props.buildDockerfile,
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
    };

    const mergedProps = { ...defautProps, ...props };

    super(scope, id, mergedProps);

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

    // Configure auto-scaling
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: mergedProps.minTaskCount,
      maxCapacity: mergedProps.maxTaskCount || 3,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Scale based on Memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });


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
  };


}

