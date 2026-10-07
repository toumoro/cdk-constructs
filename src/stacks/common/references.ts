import * as crypto from 'crypto';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';

/**
 * Number of availability zones used by `TmVpcBase`.
 */
export const VPC_MAX_AZS = 2;

/**
 * Reads an SSM parameter at deploy time (weak reference).
 */
export function readParameter(scope: Construct, parameterName: string): string {
  return ssm.StringParameter.valueForStringParameter(scope, parameterName);
}

/**
 * Imports the VPC published by `TmVpcBaseStack` without a synth-time lookup:
 * the IDs are resolved at deploy time from SSM, and the availability zones
 * come from the stack's (cached) context, like in the VPC stack itself.
 *
 * Only the subnet groups the stack uses are imported, so the template has no
 * unused parameters.
 */
export function importVpc(scope: Construct, id: string, environmentName: string, cidr: string, subnetTypes: ec2.SubnetType[]): ec2.IVpc {
  const availabilityZones = cdk.Stack.of(scope).availabilityZones.slice(0, VPC_MAX_AZS);
  const subnetIds = (subnetType: ec2.SubnetType, parameterName: string) => subnetTypes.includes(subnetType)
    ? cdk.Fn.split(',', readParameter(scope, parameterName), availabilityZones.length)
    : undefined;

  const vpc = ec2.Vpc.fromVpcAttributes(scope, id, {
    vpcId: readParameter(scope, TmParameterNames.vpcId(environmentName)),
    vpcCidrBlock: cidr,
    availabilityZones,
    publicSubnetIds: subnetIds(ec2.SubnetType.PUBLIC, TmParameterNames.vpcPublicSubnetIds(environmentName)),
    privateSubnetIds: subnetIds(ec2.SubnetType.PRIVATE_WITH_EGRESS, TmParameterNames.vpcPrivateSubnetIds(environmentName)),
    isolatedSubnetIds: subnetIds(ec2.SubnetType.PRIVATE_ISOLATED, TmParameterNames.vpcIsolatedSubnetIds(environmentName)),
  });
  cdk.Annotations.of(vpc).acknowledgeWarning('@aws-cdk/aws-ec2:noSubnetRouteTableId',
    'The package stacks never read the route tables of the imported subnets.');
  return vpc;
}

/**
 * Imports a security group whose ID is published in SSM.
 */
export function importSecurityGroup(scope: Construct, id: string, parameterName: string): ec2.ISecurityGroup {
  return ec2.SecurityGroup.fromSecurityGroupId(scope, id, readParameter(scope, parameterName));
}

/**
 * Publishes a value in SSM for other stacks.
 */
export function publishParameter(scope: Construct, id: string, parameterName: string, value: string): ssm.StringParameter {
  return new ssm.StringParameter(scope, id, {
    parameterName,
    stringValue: value,
  });
}

/**
 * A stable, concrete value for the CloudFront origin custom header, derived
 * deterministically from the account and environment.
 *
 * The ALB listener condition and the CloudFront `customHeaders` value both need
 * a CONCRETE string at synth/deploy time (an ALB listener condition cannot take
 * an unresolved Secrets Manager reference), and the two must be IDENTICAL or
 * the load balancer rejects every CloudFront request. A random
 * `generateSecretString` secret is only known at deploy time and would also
 * change on each generation, so it fits neither constraint.
 *
 * Instead the value is an HMAC-SHA256 over the stable, non-secret identity
 * (`<account>:<environmentName>`), keyed by a fixed library salt, hex-encoded
 * and truncated. The same inputs always yield the same literal, so every stack
 * that calls this with the same `account` and `environmentName` computes the
 * identical string, and it never changes across synths or deploys (no churn,
 * no transient 403). It is an origin-shared-secret header, not a user
 * credential: deriving it from stable inputs is appropriate, and it is only
 * meaningful between CloudFront and the ALB (never exposed to clients).
 */
export function originCustomHeaderValue(account: string, environmentName: string): string {
  // A fixed per-library salt so the value is not a bare hash of public inputs.
  const salt = 'tm-cdk-constructs/cloudfront-origin-custom-header/v1';
  return crypto
    .createHmac('sha256', salt)
    .update(`${account}:${environmentName}`)
    .digest('hex')
    .slice(0, 48);
}
