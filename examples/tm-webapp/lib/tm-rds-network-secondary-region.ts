import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';

interface TmRdsNetworkSecondaryRegionPropos extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly bastionHost: ec2.SecurityGroup;
}

export class TmRdsNetworkSecondaryRegionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TmRdsNetworkSecondaryRegionPropos) {
    super(scope, id, props);

    const securitygroup = new ec2.SecurityGroup(this, 'rdsSecondaryRegion', {
        vpc: props.vpc,
        allowAllOutbound: true,
    });

    securitygroup.addIngressRule(props.bastionHost, ec2.Port.tcp(3306));

    new rds.SubnetGroup(this, 'rdsNetworkSubnet', {
        description: 'rdsNetworkSubnet',
        vpc: props.vpc,
        vpcSubnets: { 
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED 
        },
    });

    new ssm.StringParameter(this, 'clusterRdsArn', {
      parameterName: '/RDS/Cluster/ARN',
      stringValue: " ",
    });

    new ssm.StringParameter(this, 'clusterRdsWrite', {
      parameterName: '/RDS/Endpoint/Write',
      stringValue: " ",
    });

    new ssm.StringParameter(this, 'clusterRdsRead', {
      parameterName: '/RDS/Endpoint/Read',
      stringValue: " ",
    });
  }
}
