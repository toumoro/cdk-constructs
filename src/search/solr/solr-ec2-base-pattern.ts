import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_ssm as ssm,
  aws_ecr_assets as ecr_assets,
  aws_route53 as route53,
  Tags,
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';


/*
*
* Construct to create a Solr EC2 instance with Docker image.
* Dependencies:
* - Ansible Stack to consfigure the Solr instance.
*
*/

export interface TmSorlEc2Props extends ec2.InstanceProps {
  /*
    * Application name for the Solr instance default Solr.
    */
  readonly ssmPathPrefix?: string;
  /*
    * The build context path.
    */
  readonly buildContextPath: string;
  /*
    * The build dockerfile.
    */
  readonly buildDockerfile?: string;
  /*
    * The build container args.
    */
  readonly buildContainerArgs?: { [key: string]: string };
  /*
    * Solr options for the container
    */
  readonly solrOpts?: string;
  /*
    * Solr Java Memory settings
    */
  readonly solrJavaMem?: string;
  /*
    * Cores to be enabled in the Solr instance.
    * Must be a list of core names separated by spaces.
    * By default: 'french english'
    */
  readonly solrTypo3SolrEnabledCores?: string;
  /*
    * The security group to allow access to the Solr instance.
    */
  readonly allowFrom?: ec2.ISecurityGroup;
  /*
    * Ebs volume size in GB for the Solr data.
    */
  readonly ebsVolumeSize?: number;
  /*
    * The hosted zone to create the A record for the Solr instance.
    */
  readonly hostedZone?: route53.IHostedZone;
  /*
    * Optional record name for the A record in the hosted zone.
    */
  readonly recordName?: string;
}

export class TmSolrEc2 extends ec2.Instance {
  /**
   * The Solr Docker image, pulled from ECR by the Ansible playbook.
   */
  public readonly dockerImageAsset: ecr_assets.DockerImageAsset;

  constructor(scope: Construct, id: string, props: TmSorlEc2Props) {

    /*
        * Create a Docker image asset for the Solr application.
        */
    const dockerImageAsset = new ecr_assets.DockerImageAsset(scope, 'ApplicationImage', {
      //directory: path.join(__dirname, '../build/'),
      //file: 'docker/Dockerfile',
      directory: props.buildContextPath,
      file: props.buildDockerfile,
      buildArgs: props.buildContainerArgs,
      followSymlinks: cdk.SymlinkFollowMode.ALWAYS,
    });

    /*
        *
        * Attention: The SSM parameters are created with the ssmPathPrefix as a prefix.
        * Used in ansible playbook to configure the Solr instance.
        *
        */
    const ssmPathPrefix = props.ssmPathPrefix || '/Solr/env-construct';
    new ssm.StringParameter(scope, 'VarAnsibleSSMPrefix', {
      parameterName: '/Ansible/prefix/ssm',
      stringValue: ssmPathPrefix,
    });
    new ssm.StringParameter(scope, 'VarDockerImage', {
      parameterName: `${ssmPathPrefix}/DOCKER_IMAGE`,
      stringValue: dockerImageAsset.imageUri,
    });
    new ssm.StringParameter(scope, 'VarSolrOpts', {
      parameterName: `${ssmPathPrefix}/SOLR_OPTS`,
      stringValue: props.solrOpts || '-XX:-UseLargePages',
    });
    new ssm.StringParameter(scope, 'VarSolrJavaMem', {
      parameterName: `${ssmPathPrefix}/SOLR_JAVA_MEM`,
      stringValue: props.solrJavaMem || '-Xms1g -Xmx1g',
    });
    new ssm.StringParameter(scope, 'VarSolrAwsCompte', {
      parameterName: `${ssmPathPrefix}/AWS_ACCOUNT`,
      stringValue: cdk.Stack.of(scope).account,
    });
    new ssm.StringParameter(scope, 'VarSolrTypo3SolrEnabledCores', {
      parameterName: `${ssmPathPrefix}/TYPO3_SOLR_ENABLED_CORES`,
      stringValue: props.solrTypo3SolrEnabledCores || 'french english',
    });
    /*
        * Default properties for the EC2 instance.
        */
    const subnetSolr = props.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC,
    }).subnets[0];

    const instanceType = props.instanceType || new ec2.InstanceType('t3.medium');
    const machineImage = props.machineImage || ec2.MachineImage.latestAmazonLinux2023();
    const securityGroup = props.allowFrom || new ec2.SecurityGroup(scope, 'SolrSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    const defautProps: ec2.InstanceProps = {
      vpc: props.vpc,
      instanceType: instanceType,
      machineImage: machineImage,
      securityGroup: securityGroup,
      vpcSubnets: { subnets: [subnetSolr] },
      ssmSessionPermissions: true,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20),
      }],
    };

    const mergedProps = { ...defautProps, ...props };

    super(scope, id, mergedProps);
    this.dockerImageAsset = dockerImageAsset;

    /*
        * Tag to ansible playbook to identify the Solr instance.
        */
    Tags.of(this).add('solrinstance', 'true');

    /*
        * Allow Solr instance to access the ssm parameters store.
        */
    // `ssmPathPrefix` starts with a slash and the parameter ARN takes a single
    // one (`parameter/Solr/...`): strip it, or the resource never matches.
    const stack = cdk.Stack.of(scope);
    const ssmPathArnPrefix = `arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter/${ssmPathPrefix.replace(/^\/+/, '')}`;
    this.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:PutParameter',
        'ssm:DescribeParameters',
        'ssm:DeleteParameter',
      ],
      resources: [ssmPathArnPrefix, `${ssmPathArnPrefix}/*`],
    }));
    // The Ansible playbook reads the prefix itself (`/Ansible/prefix/ssm`).
    this.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [`arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter/Ansible/prefix/ssm`],
    }));
    /*
        * Add the Docker image asset repository to the role permissions.
        * This allows the EC2 instance to pull the Docker image from ECR.
        */
    dockerImageAsset.repository.grantPull(this.role);
    /*
        * Add the SSM managed policy to the role.
        * This allows the EC2 instance to be managed by SSM.
        */
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    );

    /*
        * The tm-ansible playbook (solr-ec2-deploy.yml, aws/auto-attach-ec2-ebs.yml)
        * finds the data volume by its `solrdata` tag, attaches it to the instance
        * it runs on and waits for the attachment. That needs the Describe calls
        * (no resource-level permissions) and Attach/Detach on exactly two
        * resources: a volume tagged `solrdata` and an instance tagged
        * `solrinstance` (both tags are set below). Nothing else from EC2.
        */
    this.addToRolePolicy(new iam.PolicyStatement({
      sid: 'DescribeVolumesAndInstances',
      actions: [
        'ec2:DescribeInstances',
        'ec2:DescribeInstanceAttribute',
        'ec2:DescribeVolumes',
        'ec2:DescribeVolumeStatus',
        'ec2:DescribeVolumeAttribute',
        'ec2:DescribeTags',
      ],
      resources: ['*'],
    }));
    this.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AttachOwnDataVolume',
      actions: ['ec2:AttachVolume', 'ec2:DetachVolume'],
      resources: [`arn:${stack.partition}:ec2:${stack.region}:${stack.account}:volume/*`],
      conditions: { StringEquals: { 'ec2:ResourceTag/solrdata': 'true' } },
    }));
    this.addToRolePolicy(new iam.PolicyStatement({
      sid: 'AttachToSelf',
      actions: ['ec2:AttachVolume', 'ec2:DetachVolume', 'ec2:ModifyInstanceAttribute'],
      resources: [`arn:${stack.partition}:ec2:${stack.region}:${stack.account}:instance/*`],
      conditions: { StringEquals: { 'ec2:ResourceTag/solrinstance': 'true' } },
    }));

    /*
        * Create volume for Solr data.
        */
    const volumeData = new ec2.CfnVolume(this, 'EbsVolume', {
      availabilityZone: subnetSolr.availabilityZone,
      size: props.ebsVolumeSize || 30, // Default size is 30 GB if not provided
      volumeType: 'gp3',
    });
    // Set retention policy for the EBS volume
    volumeData.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    /*
        * Attach the EBS volume to the Solr instance.
        * This is the volume where Solr data will be stored.
        * Ansible playbook will mount this volume to the Solr instance.
        */
    Tags.of(volumeData).add('solrdata', 'true');

    if (props.hostedZone) {
      const route53Record = new route53.ARecord(scope, 'SolrAliasRecord', {
        zone: props.hostedZone,
        recordName: props.recordName || 'solr', // Will create solr.example.internal
        target: route53.RecordTarget.fromIpAddresses(this.instancePrivateIp),
      });

      new ssm.StringParameter(scope, 'VarSolrDnsName', {
        parameterName: `${ssmPathPrefix}/Endpoint/Writer`,
        stringValue: route53Record.domainName,
      });
    }
  }
}