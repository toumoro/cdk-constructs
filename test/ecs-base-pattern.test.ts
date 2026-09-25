import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { TmApplicationLoadBalancedFargateService } from '../src';

const buildContextPath = path.join(__dirname, 'fixtures', 'ecs-app');

test('target group uses least outstanding requests by default', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });

  new TmApplicationLoadBalancedFargateService(stack, 'Service', {
    vpc,
    buildContextPath,
    buildDockerfile: 'Dockerfile',
    protocol: elbv2.ApplicationProtocol.HTTP,
    minTaskCount: 1,
    maxTaskCount: 2,
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
    TargetGroupAttributes: Match.arrayWith([
      { Key: 'load_balancing.algorithm.type', Value: 'least_outstanding_requests' },
    ]),
  });
});

test('target group load balancing algorithm is overridable', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });

  new TmApplicationLoadBalancedFargateService(stack, 'Service', {
    vpc,
    buildContextPath,
    buildDockerfile: 'Dockerfile',
    protocol: elbv2.ApplicationProtocol.HTTP,
    minTaskCount: 1,
    maxTaskCount: 2,
    loadBalancingAlgorithmType: elbv2.TargetGroupLoadBalancingAlgorithmType.ROUND_ROBIN,
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
    TargetGroupAttributes: Match.arrayWith([
      { Key: 'load_balancing.algorithm.type', Value: 'round_robin' },
    ]),
  });
});

test('target group health check is left at the default when not provided', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });

  new TmApplicationLoadBalancedFargateService(stack, 'Service', {
    vpc,
    buildContextPath,
    buildDockerfile: 'Dockerfile',
    protocol: elbv2.ApplicationProtocol.HTTP,
    minTaskCount: 1,
    maxTaskCount: 2,
  });

  const template = Template.fromStack(stack);
  // Backwards compatibility: we must not emit any health check overrides
  // (path / thresholds / intervals / matcher) when healthCheck is not passed.
  template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
    HealthCheckPath: Match.absent(),
    HealthCheckIntervalSeconds: Match.absent(),
    HealthCheckTimeoutSeconds: Match.absent(),
    HealthyThresholdCount: Match.absent(),
    UnhealthyThresholdCount: Match.absent(),
    Matcher: Match.absent(),
  });
});

test('target group health check is applied when provided', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  const vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });

  new TmApplicationLoadBalancedFargateService(stack, 'Service', {
    vpc,
    buildContextPath,
    buildDockerfile: 'Dockerfile',
    protocol: elbv2.ApplicationProtocol.HTTP,
    minTaskCount: 1,
    maxTaskCount: 2,
    targetGroupHealthCheck: {
      protocol: elbv2.Protocol.HTTP,
      path: '/typo3/',
      port: 'traffic-port',
      unhealthyThresholdCount: 6,
      timeout: Duration.seconds(10),
      interval: Duration.seconds(60),
      healthyThresholdCount: 2,
      healthyHttpCodes: '200',
    },
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
    HealthCheckProtocol: 'HTTP',
    HealthCheckPath: '/typo3/',
    HealthCheckPort: 'traffic-port',
    UnhealthyThresholdCount: 6,
    HealthCheckTimeoutSeconds: 10,
    HealthCheckIntervalSeconds: 60,
    HealthyThresholdCount: 2,
    Matcher: { HttpCode: '200' },
  });
});
