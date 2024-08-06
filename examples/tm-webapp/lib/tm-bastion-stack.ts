import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface TmBastion extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class BastionStack extends cdk.Stack {
    public readonly securityGroupBastion: ec2.SecurityGroup;
    
    constructor(scope: Construct, id: string, props: TmBastion) {
      super(scope, id, props);

        this.securityGroupBastion = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
            vpc: props.vpc,
            allowAllOutbound: true,
            securityGroupName: 'bastion-security-group',
        });

        const packageName: Array<string> = [
          'docker',
          'git',
          'jq',
          'mysql',
        ];

        new ec2.BastionHostLinux(this, 'BastionHost', {
            vpc: props.vpc,
            instanceName: 'BastionHost',
            subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
            securityGroup: this.securityGroupBastion,
            init: ec2.CloudFormationInit.fromConfigSets({
              configSets: {
                // Applies the configs below in this order
                default: ['yumPreinstall', 'config'],
              },
              configs: {
                yumPreinstall: new ec2.InitConfig([
                  ...packageName.map(packageName => ec2.InitPackage.yum(packageName)),
                ]),
                config: new ec2.InitConfig([]),
              },
            }),
        });

    }
}

