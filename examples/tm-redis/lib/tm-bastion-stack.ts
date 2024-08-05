import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface TmBastion extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class TmBastionStack extends cdk.Stack {
    public readonly bastionHost: ec2.BastionHostLinux;
    
    constructor(scope: Construct, id: string, props: TmBastion) {
      
      super(scope, id, props);

        this.bastionHost = new ec2.BastionHostLinux(this, 'BastionHostRedis', {
            vpc: props.vpc,
            instanceName: 'BastionHost',
            subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
        });

    }
}

