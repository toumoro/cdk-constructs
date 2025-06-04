import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as path from 'path';
import { TmSolrEc2, TmSorlEc2Props } from '../../../src';


interface TmSolrEc2StackProps extends cdk.StackProps {
    vpc: ec2.IVpc;
    hostedZone?: route53.IHostedZone;
}

export class TmSolrEc2Stack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: TmSolrEc2StackProps) {
        super(scope, id, props);

        const solrProps: TmSorlEc2Props = {
            vpc: props.vpc,
            hostedZone: props.hostedZone,
            ebsVolumeSize: 30,
            buildContextPath: path.join(__dirname, '../build/'),
            buildDockerfile: 'docker/solr-9.8/Dockerfile',
            instanceType: new ec2.InstanceType('t3.small'),
            machineImage: ec2.MachineImage.latestAmazonLinux2023(),
        };

        new TmSolrEc2(this, 'SolrInstance', solrProps);

    }
}