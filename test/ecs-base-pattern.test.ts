import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
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
