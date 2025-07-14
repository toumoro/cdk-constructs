import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as triggers from 'aws-cdk-lib/triggers';
import { Construct } from 'constructs';

/**
 * Props for `TmEcsDeploymentHook`.
 */
export interface TmEcsDeploymentHookProps extends cdk.StackProps {
  /**
   * The ECS task definition to run.
   */
  taskDefinition: ecs.FargateTaskDefinition;
  /**
   * The ECS cluster where the task will be run.
   */
  cluster: ecs.ICluster;
  /**
   * The subnets where the task will be launched.
   */
  subnets: ec2.ISubnet[];
  /**
   * The security groups to associate with the task.
   */
  securityGroups: ec2.ISecurityGroup[];
  /**
   * The name of the container in the task definition.
   */
  containerName: string;
  /**
   * The command to run in the container.
   * This should be an array of strings, where the first element is the command and the subsequent elements are its arguments.
   */
  command: string[];
}

export class TmEcsDeploymentHook extends Construct {
  constructor(scope: Construct, id: string, props: TmEcsDeploymentHookProps) {
    super(scope, id);


    const logGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/${cdk.Names.uniqueId(this)}-TmEcsDeploymentHookLambda`, // Consistent naming
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Deployment Hook Lambda
    const lambdaFunction = new lambda.Function(this, 'LambdaFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        // Updated at ${Date.now()} (to trigger at every deployment)
        const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs');

        const ecs = new ECSClient();

        exports.handler = async (event) => {
          console.log('ECS deployment hook triggered:', JSON.stringify(event));

          const taskDefinitionArn = '${props.taskDefinition.taskDefinitionArn}';
          const clusterName = '${props.cluster.clusterName}';
          const subnets = ${JSON.stringify(props.subnets.map(subnet => subnet.subnetId))};
          const securityGroups = ${JSON.stringify(props.securityGroups.map(sg => sg.securityGroupId))};
          const containerName = '${props.containerName}';
          const containerCommand = ${JSON.stringify(props.command)};

          try {
            const input = {
              cluster: clusterName,
              taskDefinition: taskDefinitionArn,
              launchType: 'FARGATE',
              networkConfiguration: {
                awsvpcConfiguration: {
                  subnets: subnets,
                  securityGroups: securityGroups,
                  assignPublicIp: 'ENABLED'
                }
              },
              overrides: {
                containerOverrides: [
                  {
                    name: containerName,
                    command: containerCommand
                  }
                ]
              }
            };

            const runTaskCommand = new RunTaskCommand(input);
            const response = await ecs.send(runTaskCommand);

            console.log('Task launched:', JSON.stringify(response));

            return {
              PhysicalResourceId: response.tasks[0].taskArn,
              Data: {
                Result: 'Task launched successfully',
                TaskArn: response.tasks[0].taskArn
              }
            };
          } catch (error) {
            console.error('Failed to launch task:', error);
            throw error;
          }
        };
      `),
      timeout: cdk.Duration.minutes(1),
      logGroup: logGroup,
    });

    // Grant permissions to run ECS tasks
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ecs:RunTask'],
      resources: [props.taskDefinition.taskDefinitionArn],
    }));

    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [
        props.taskDefinition.taskRole.roleArn,
        props.taskDefinition.executionRole?.roleArn || '*',
      ],
    }));

    new triggers.Trigger(this, 'Trigger', {
      handler: lambdaFunction,
      timeout: Duration.minutes(1),
      invocationType: triggers.InvocationType.EVENT,
    });
  }
}