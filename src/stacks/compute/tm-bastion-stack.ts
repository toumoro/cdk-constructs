import * as cdk from 'aws-cdk-lib';
import { Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { TmAnsiblePlaybookEc2 } from '../../management/ansible';
import { TmPatchManager } from '../../management/patchmanager';
import { importVpc, publishParameter } from '../common/references';

/**
 * Props for `TmBastionStack`.
 */
export interface TmBastionStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * CIDR range of the VPC.
   */
  readonly vpcCidr: string;

  /**
   * EC2 instance type.
   *
   * @default 't3.small'
   */
  readonly instanceType?: string;
}

/**
 * Bastion host in a public subnet, reachable through SSM Session Manager,
 * patched by Patch Manager and configured by the tm-ansible playbook.
 * Publishes its security group ID in SSM.
 */
export class TmBastionStack extends cdk.Stack {
  /** Security group of the bastion. */
  public readonly securityGroup: ec2.SecurityGroup;
  /** The bastion host. */
  public readonly bastionHost: ec2.BastionHostLinux;

  constructor(scope: Construct, id: string, props: TmBastionStackProps) {
    super(scope, id, props);

    const vpc = importVpc(this, 'Vpc', props.environmentName, props.vpcCidr, [ec2.SubnetType.PUBLIC]);

    this.securityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });

    this.bastionHost = new ec2.BastionHostLinux(this, 'Bastion', {
      vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: this.securityGroup,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      instanceType: new ec2.InstanceType(props.instanceType ?? 't3.small'),
    });

    this.bastionHost.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    );

    // The bastion reads the account's SSM parameters by path (tm-ansible, operators).
    this.bastionHost.role.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParametersByPath'],
      resources: [`arn:${this.partition}:ssm:${this.region}:${this.account}:parameter/*`],
    }));

    // The timestamp makes the Ansible association run on every deployment.
    const bastionAnsibleTag = `Bastion-${String(Date.now())}`;

    Tags.of(this.bastionHost).add('BastionAnsible', bastionAnsibleTag);
    Tags.of(this.bastionHost).add('PatchGroup', 'tmPatchGroup');
    Tags.of(this.bastionHost).add('autoStopStart', 'true');

    new TmAnsiblePlaybookEc2(this, 'TmBastionAnsiblePlaybook', {
      tagTargetKey: 'BastionAnsible',
      tagTargetValue: bastionAnsibleTag,
    });

    new TmPatchManager(this, 'TmBastionSystemsManager', {});

    publishParameter(this, 'SecurityGroupIdParameter',
      TmParameterNames.bastionSecurityGroupId(props.environmentName), this.securityGroup.securityGroupId);
  }
}
