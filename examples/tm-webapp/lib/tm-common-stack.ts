import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CommonStack extends cdk.Stack {
    public readonly customHttpHeaderValue: cdk.CfnParameter;
    public readonly domainName: cdk.CfnParameter;
    public readonly hostedZoneId: cdk.CfnParameter;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.customHttpHeaderValue = new cdk.CfnParameter(this, 'customHttpHeaderValue', {
            type: 'String',
            description: 'The custom HTTP Header value',
        });

        this.domainName = new cdk.CfnParameter(this, 'domainName', {
            type: 'String',
            description: 'The Application FQDN',
            //allowedPattern: '^(\*\.)?(((?!-)[A-Za-z0-9-]{0,62}[A-Za-z0-9])\.)+((?!-)[A-Za-z0-9-]{1,62}[A-Za-z0-9])$',
            //constraintDescription: 'Must be a valid domain name.',
        });

        this.hostedZoneId = new cdk.CfnParameter(this, 'hostedZoneId', {
            type: 'String',
            description: 'The Route53 hosted zone ID',
        });
    }
}