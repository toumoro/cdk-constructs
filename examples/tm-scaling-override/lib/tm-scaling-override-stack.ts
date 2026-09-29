import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { TmApplicationLoadBalancedFargateService } from 'tm-cdk-constructs';

/**
 * Example stack demonstrating how to COMPLETELY OVERRIDE the built-in
 * auto-scaling of `TmApplicationLoadBalancedFargateService`.
 *
 * By default the construct applies CPU + memory target-tracking policies. Set
 * `disableDefaultScaling: true` to skip those entirely and attach your own
 * policies to the exposed `scalableTaskCount` — target-tracking, request-count,
 * step, and scheduled scaling can all coexist.
 */
export class TmScalingOverrideStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });

    const service = new TmApplicationLoadBalancedFargateService(this, 'Service', {
      vpc,
      buildContextPath: path.join(__dirname, '..', 'build'),
      buildDockerfile: 'Dockerfile',
      containerPort: 80,
      // HTTP keeps the example synthesizable without a domain/certificate.
      protocol: elbv2.ApplicationProtocol.HTTP,
      minTaskCount: 2,
      maxTaskCount: 20,

      // Skip the built-in CPU + memory 30% target-tracking policies entirely
      // and take full control of scaling below.
      disableDefaultScaling: true,
    });

    // `scalableTaskCount` is always created with the min/max bounds above
    // (2..20) and exposed for custom policies.
    const scaling = service.scalableTaskCount;

    // 1) Target-tracking on CPU — keep average CPU near 55%.
    scaling.scaleOnCpuUtilization('CpuTracking', {
      targetUtilizationPercent: 55,
      scaleInCooldown: Duration.seconds(120),
      scaleOutCooldown: Duration.seconds(60),
    });

    // 2) Target-tracking on memory — keep average memory near 70%.
    scaling.scaleOnMemoryUtilization('MemoryTracking', {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(120),
      scaleOutCooldown: Duration.seconds(60),
    });

    // 3) Target-tracking on ALB request count per target.
    scaling.scaleOnRequestCount('RequestTracking', {
      requestsPerTarget: 1000,
      targetGroup: service.targetGroup,
      scaleInCooldown: Duration.seconds(120),
      scaleOutCooldown: Duration.seconds(60),
    });

    // 4) Step scaling on a custom CloudWatch metric (e.g. SQS backlog).
    //    Fine-grained, threshold-based add/remove of tasks.
    const backlogMetric = new cloudwatch.Metric({
      namespace: 'AWS/SQS',
      metricName: 'ApproximateNumberOfMessagesVisible',
      dimensionsMap: { QueueName: 'my-work-queue' },
      period: Duration.minutes(1),
      statistic: 'Sum',
    });

    scaling.scaleOnMetric('QueueBacklogStepScaling', {
      metric: backlogMetric,
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: Duration.seconds(60),
      scalingSteps: [
        { upper: 100, change: 0 }, // 0-100 msgs: no change
        { lower: 100, change: +2 }, // 100+ msgs: add 2 tasks
        { lower: 500, change: +4 }, // 500+ msgs: add 4 tasks
        { lower: 1000, change: +8 }, // 1000+ msgs: add 8 tasks
      ],
    });

    // 5) Scheduled scaling — raise the floor during business hours,
    //    drop it back overnight (times are UTC).
    scaling.scaleOnSchedule('BusinessHoursUp', {
      schedule: appscaling.Schedule.cron({ hour: '13', minute: '0' }), // 09:00 EDT
      minCapacity: 6,
    });
    scaling.scaleOnSchedule('OvernightDown', {
      schedule: appscaling.Schedule.cron({ hour: '1', minute: '0' }), // 21:00 EDT
      minCapacity: 2,
    });
  }
}
