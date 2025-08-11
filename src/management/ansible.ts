import {
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

/*
*
* Construct to Run Ansible Playbook.
*
*/

export interface IAnsiblePlaybookEc2Props {
  tagTargetKey?: string;
  tagTargetValue?: string;
  gitHubRepository?: string;
  gitHubOwner?: string;
  gitHubBranch?: string;
  gitHubPath?: string;
  playbookFile?: string;
}

export class TmAnsiblePlaybookEc2 extends Construct {

  constructor(scope: Construct, id: string, props: IAnsiblePlaybookEc2Props) {

    super(scope, id);

    const {
      tagTargetKey = 'Name',
      tagTargetValue = 'BastionHost',
      gitHubRepository = 'tm-ansible',
      gitHubOwner = 'toumoro',
      gitHubBranch = 'main',
      gitHubPath = 'playbooks',
      playbookFile = 'docker-deploy.yml',
    } = props;

    const parametersAnsible = {
      SourceType: [
        'GitHub',
      ],
      SourceInfo: [
        JSON.stringify({
          owner: `${gitHubOwner}`,
          repository: `${gitHubRepository}`,
          path: `${gitHubPath}`,
          getOptions: `branch:${gitHubBranch}`,
        }),
      ],
      InstallDependencies: [
        'True',
      ],
      PlaybookFile: [
        `${playbookFile}`,
      ],
      Check: [
        'False',
      ],
      Verbose: [
        '-v',
      ],
    };

    new ssm.CfnAssociation(this, `AnsiblePlaybookAssociation${tagTargetValue}`, {
      name: 'AWS-ApplyAnsiblePlaybooks', // Required document name
      parameters: parametersAnsible,
      targets: [
        {
          key: `tag:${tagTargetKey}`,
          values: [`${tagTargetValue}`],
        },
      ],
      associationName: `Deployment-${tagTargetValue}-${String(Date.now())}`,
      applyOnlyAtCronInterval: false,
      waitForSuccessTimeoutSeconds: 600,
      maxConcurrency: '1', // Only one instance at a time
      maxErrors: '3',
      // Debug deployment
      /*
            outputLocation: {
                s3Location: {
                    outputS3BucketName: '', // Replace with your S3 bucket name
                },
            },
            */
    });

  }
}