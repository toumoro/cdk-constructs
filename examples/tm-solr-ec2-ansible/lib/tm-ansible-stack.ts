import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';


interface TmSolrAnsibleProps extends cdk.StackProps {}

export class TmSolrAnsible extends cdk.Stack {

    constructor(scope: Construct, id: string, props: TmSolrAnsibleProps) {
        super(scope, id, props);
    
        const parametersAnsible = {
            SourceType: [
                'GitHub'
            ],
            SourceInfo: [
                JSON.stringify({
                    'owner':'toumoro',
                    'repository':'tm-ansible',
                    'path':'playbooks',
                    'getOptions':'branch:main'
                })
            ],
            InstallDependencies: [
                'True'
            ],
            PlaybookFile: [
                'solr-ec2-deploy.yml'
            ],
            Check: [
                'False'
            ],
            Verbose: [
                '-v'
            ]
        };

        new ssm.CfnAssociation(this, 'AnsiblePlaybookAssociation', {
            name: 'AWS-ApplyAnsiblePlaybooks', // Required document name
            parameters: parametersAnsible,
            targets: [
                {
                    key: 'tag:solrinstance',
                    values: ['true'],
                },
            ],
            associationName: `Install-SolrEcs-${String(Date.now())}`,
            applyOnlyAtCronInterval: false,
            waitForSuccessTimeoutSeconds: 600,
            maxErrors: '3',
            // Debug deployment if needed
            /*
            outputLocation: {
                s3Location: {
                    outputS3BucketName: '<Bucket-S3-Name>', // Replace with your S3 bucket name
                },
            },
            */
        });

    }
}