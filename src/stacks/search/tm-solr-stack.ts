import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';
import { TmAnsiblePlaybookEc2 } from '../../management/ansible';
import { TmSolrEc2 } from '../../search/solr/solr-ec2-base-pattern';
import { importSecurityGroup, importVpc, publishParameter, readParameter } from '../common/references';

/**
 * Port the Solr instance listens on.
 */
const SOLR_PORT = 8983;

/**
 * Props for `TmSolrStack`.
 */
export interface TmSolrStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * CIDR range of the VPC.
   */
  readonly vpcCidr: string;

  /**
   * Name of the private hosted zone attached to the VPC. Used to create the A
   * record of the Solr instance.
   */
  readonly hostedZoneName: string;

  /**
   * Docker build context of the Solr image (the application's `docker/solr`
   * directory). Separate from the application image's own build context.
   */
  readonly buildContextPath: string;

  /**
   * EC2 instance type.
   *
   * @default 't3.medium'
   */
  readonly instanceType?: string;

  /**
   * Data volume size in GiB (gp3, retained).
   *
   * @default 30
   */
  readonly ebsVolumeSize?: number;

  /**
   * Solr Java memory settings (`SOLR_JAVA_MEM`).
   *
   * @default '-Xms1g -Xmx1g'
   */
  readonly solrJavaMem?: string;

  /**
   * Solr JVM options (`SOLR_OPTS`).
   *
   * @default '-XX:-UseLargePages'
   */
  readonly solrOpts?: string;

  /**
   * Solr cores enabled by the TYPO3 Solr extension, a space-separated list.
   *
   * @default 'french english'
   */
  readonly enabledCores?: string;

  /**
   * A record name of the Solr instance in the private hosted zone.
   *
   * @default 'solr'
   */
  readonly recordName?: string;
}

/**
 * Apache Solr EC2 instance, reachable on port 8983 from the bastion and from
 * the ECS task. Publishes its writer endpoint, port and security group ID in
 * SSM so the ECS stack reads them like the RDS and Redis endpoints.
 *
 * The ECS task security group does not exist yet when this stack is built, so
 * (like RDS and Redis) the ingress rule from the task is added by the ECS stack
 * after it imports this stack's security group ID from SSM.
 */
export class TmSolrStack extends cdk.Stack {
  /** The Solr instance. */
  public readonly instance: TmSolrEc2;

  constructor(scope: Construct, id: string, props: TmSolrStackProps) {
    super(scope, id, props);

    const env = props.environmentName;
    const vpc = importVpc(this, 'Vpc', env, props.vpcCidr, [ec2.SubnetType.PUBLIC]);
    const bastionSecurityGroup = importSecurityGroup(this, 'BastionSecurityGroup', TmParameterNames.bastionSecurityGroupId(env));

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'PrivateHostedZone', {
      hostedZoneId: readParameter(this, TmParameterNames.vpcHostedZoneId(env)),
      zoneName: props.hostedZoneName,
    });

    // The construct creates its own security group when `allowFrom` is absent
    // (otherwise it REPLACES it). The ingress rules are then added at the stack
    // level.
    this.instance = new TmSolrEc2(this, 'SolrInstance', {
      vpc,
      instanceType: new ec2.InstanceType(props.instanceType ?? 't3.medium'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      buildContextPath: props.buildContextPath,
      solrJavaMem: props.solrJavaMem,
      solrOpts: props.solrOpts,
      solrTypo3SolrEnabledCores: props.enabledCores,
      ebsVolumeSize: props.ebsVolumeSize,
      hostedZone,
      recordName: props.recordName,
    });

    // The instance is only a host: tm-ansible's solr-ec2-deploy.yml attaches
    // and mounts the `solrdata` volume, installs Docker, pulls the image and
    // runs Solr. The association targets the `solrinstance` tag, so a
    // replaced instance is configured as soon as it registers with SSM; the
    // image hash in its name runs the playbook again when the image changes.
    // SSM downloads tm-ansible (private) with the GitHub token stored in the
    // SecureString parameter `/ansible/tm/github/token`, like the bastion.
    new TmAnsiblePlaybookEc2(this, 'SolrAnsiblePlaybook', {
      tagTargetKey: 'solrinstance',
      tagTargetValue: 'true',
      playbookFile: 'solr-ec2-deploy.yml',
      associationName: `Deployment-Solr-${env}-${this.instance.dockerImageAsset.assetHash.slice(0, 12)}`,
    });

    // Access to the Solr port from the bastion. Access from the ECS task is
    // added by the ECS stack (the task security group does not exist here yet),
    // through the ID published below.
    this.instance.connections.allowFrom(bastionSecurityGroup, ec2.Port.tcp(SOLR_PORT), 'Allow from bastion');

    publishParameter(this, 'SolrSecurityGroupIdParameter',
      TmParameterNames.solrSecurityGroupId(env), this.instance.connections.securityGroups[0].securityGroupId);
    publishParameter(this, 'SolrWriterEndpointParameter',
      TmParameterNames.solrWriterEndpoint(env), `${props.recordName ?? 'solr'}.${props.hostedZoneName}`);
    publishParameter(this, 'SolrWriterPortParameter',
      TmParameterNames.solrWriterPort(env), String(SOLR_PORT));
  }
}
