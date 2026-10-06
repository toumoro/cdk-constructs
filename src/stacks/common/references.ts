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
