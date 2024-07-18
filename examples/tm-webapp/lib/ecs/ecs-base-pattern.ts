import { Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';


/**
 * Represents the configuration for an ecsPatterns.
 */

export interface TmApplicationLoadBalancedFargateServiceProps extends ecsPatterns.ApplicationLoadBalancedFargateServiceProps {

  /**
 * The number of cpu units used by the task.
 */
  readonly vpc?: ec2.IVpc;

  /**
 * The number of cpu units used by the task.
 */
  readonly cpu?: number;

  /**
 * The amount (in MiB) of memory used by the task.
 */
  readonly memoryLimitMiB?: number;

  /**
 * The desired number of instantiations of the task definition to keep running on the service.
 */
  readonly desiredCount?: number;

  /**
* The container port.
*/
  readonly containerPort?: number;

  /**
* The certificate .
*/
  readonly certificate?: ICertificate;

  /**
* The listener port.
*/
  readonly listenerPort?: number;

  /**
* The minumun number od tasks.
*/
  readonly minTaskCount?: number;

  /**
* The maximum number of task.
*/
  readonly maxTaskCount?: number;


}


export class TmApplicationLoadBalancedFargateService extends ecsPatterns.ApplicationLoadBalancedFargateService {

  constructor(scope: Construct, id: string, props: TmApplicationLoadBalancedFargateServiceProps,) {
    // Define the Docker image asset
    const dockerImageAsset = new ecr_assets.DockerImageAsset(scope, 'ApplicationImage', {
      directory: path.join(__dirname, '../../build/docker'),
    });

    const defautProps: TmApplicationLoadBalancedFargateServiceProps = {
      vpc: props.vpc,
      assignPublicIp: true,
      enableExecuteCommand: true,
      memoryLimitMiB: 2048,
      cpu: 1024,
      desiredCount: 2,
      minTaskCount: 1,
      maxTaskCount: 3,
      listenerPort: 443,
      openListener: false,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      targetProtocol: elbv2.ApplicationProtocol.HTTP,
      taskSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset),
        //image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        containerPort: props.containerPort, // Optional: Specify the container port
        enableLogging: true,
        containerName: 'web',
        // environment: { // Optional: Add environment variables
        //   ENV_VAR_NAME: 'value'
        // },
        // secrets: { // Optional: Add secrets from AWS Secrets Manager
        //   SECRET_NAME: ecs.Secret.fromSecretsManager(secret)
        // }
      }
    };

    const mergedProps = { ...defautProps, ...props };

    super(scope, id, mergedProps);

    // Remove the default action by setting a new default action with conditions
    this.listener.addTargetGroups('HeaderConditionForward', {
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.httpHeader('X-Custom-Header', ['sdsdsdsdsd'])
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
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });

    // Scale based on Memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });

 
  };


}

