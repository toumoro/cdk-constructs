import { Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

/**
 * Represents the configuration for an ecsPatterns.
 */

export interface TmApplicationLoadBalancedFargateServiceProps extends ecsPatterns.ApplicationLoadBalancedFargateServiceProps {

  /**
* The container port.
*/
  readonly containerPort?: number;

  /**
* The minumun number od tasks.
*/
  readonly minTaskCount?: number;

  /**
* The maximum number of task.
*/
  readonly maxTaskCount?: number;
  /**
   * The custom http header value.
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

}


export class TmApplicationLoadBalancedFargateService extends ecsPatterns.ApplicationLoadBalancedFargateService {

  constructor(scope: Construct, id: string, props: TmApplicationLoadBalancedFargateServiceProps) {

    const dockerImageAsset = new ecr_assets.DockerImageAsset(scope, 'ApplicationImage', {
      //directory: path.join(__dirname, '../build/'),
      //file: 'docker/Dockerfile',
      directory: props.buildContextPath,
      file: props.buildDockerfile,
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
        subnetType: ec2.SubnetType.PUBLIC,
      },
      buildContextPath: props.buildContextPath,
      buildDockerfile: props.buildDockerfile,
      taskImageOptions: {
        //image: ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset),
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset),
        //image: ecs.ContainerImage.fromAsset('build'),
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
      },
    };

    const mergedProps = { ...defautProps, ...props };

    super(scope, id, mergedProps);

    // Remove the default action by setting a new default action with conditions
    this.listener.addTargetGroups('HeaderConditionForward', {
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.httpHeader('X-Custom-Header', ['sdsdsdsdsd']),
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

