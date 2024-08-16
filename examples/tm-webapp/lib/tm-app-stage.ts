import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { TmVpcbaseStack } from './tm-vpc-base-stack';
import { BastionStack } from './tm-bastion-stack';
import { TmEcsStack, TmEcsStackProps } from './tm-ecs-stack';
import { TmRdsNetworkSecondaryRegionStack } from './tm-rds-network-secondary-region';
import { TmRdsAuroraMysqlServerlessStack } from './tm-rds-aurora-mysql-serverless-stack';
import { TmRedisGlobalStack } from './tm-redis-global-stack';
import { TmRedisStack } from './tm-redis-stack';
import { NagSuppressions, AwsSolutionsChecks } from 'cdk-nag';
import * as path from 'path';
import { TmCloudfrontStack, TmCloudfrontStackProps } from './tm-cloudfront-stack';
import { TmCloudfrontCdnStack, TmCloudfrontCdnStackProps } from './tm-cloudfront-cdn-stack';
import { TmS3Stack } from './tm-s3-stacks';
import { TmServiceIamUsersStack, TmServiceIamUsersStackProps } from './tm-iam-user-services-stack';
import * as s3 from 'aws-cdk-lib/aws-s3';

interface RegionParameters {
  vpc: {
    range: string;
  }
  rds: {
    isRdsMainRegion: boolean;
  }
  ecs: {
    crossRegionReferences: boolean;
    buildContextPath: string;
    buildDockerfile: string;
    applicationName: string;
    hostedZoneIdParameterName: string;
    customHttpHeaderParameterName: string;
    domainParameterName: string;
    secretsFromSsmParameterStore?: string[];
    additionalSecretsFromParameterStore?: { [key: string]: string };
    scheduledTaskScheduleExpression?: cdk.aws_events.Schedule;
    scheduledTasksCommand?: string;
  }
  elasticache?: {
    isRedisGlobalReplication?: boolean;
  }
}

interface MainRegionRedisProps {
  globalReplicationGroupId?: string;
}

interface Stacks {
  vpc?: TmVpcbaseStack;
  bastion?: BastionStack;
  ecs?: TmEcsStack;
  rds?: TmRdsAuroraMysqlServerlessStack | TmRdsNetworkSecondaryRegionStack;
  redis?: TmRedisGlobalStack | TmRedisStack;
  s3?: TmS3Stack;
  cloudfront?: TmCloudfrontStack;
  cloudfrontCdn?: TmCloudfrontCdnStack;
  iam?: TmServiceIamUsersStack;
}

export class TmPipelineAppStage extends cdk.Stage {

  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    function toPascalCase(input: string): string {
      return input
        .split(/[\s_\-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    }


    const commonEcsStackProps = {
      crossRegionReferences: true,
      buildContextPath: path.join(__dirname, '../build/'),
      buildDockerfile: 'docker/Dockerfile',
      applicationName: 'tm',
      hostedZoneIdParameterName: 'hostedZoneId',
      customHttpHeaderParameterName: 'customHttpHeaderValue',
      domainParameterName: 'domainName',
      secretsFromSsmParameterStore: ['TM_SECRET'],
      additionalSecretsFromParameterStore: { 'TM_DATABASE_WRITER_HOSTNAME': '/RDS/Endpoint/Write' },
    }

    const regions: { [region: string]: RegionParameters } = {
      'ca-central-1': {
        vpc: {
          range: '10.3.0.0/16',
        },
        rds: {
          isRdsMainRegion: true,
        },
        ecs: commonEcsStackProps,
        elasticache: {
          isRedisGlobalReplication: true,
        },
      },
      'eu-west-3': {
        vpc: {
          range: '10.4.0.0/16',
        },
        rds: {
          isRdsMainRegion: false,
        },
        ecs: commonEcsStackProps,
        elasticache: {
          isRedisGlobalReplication: false,
        },
      },
    };

    let mainRegionRedisProps: MainRegionRedisProps = {};

    const stacks: { [region: string]: Stacks } = {};

    Object.entries(regions).forEach(([region, regionProps]) => {
      const env = {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: region,
      };
      const regionName = toPascalCase(region);

      const vpc = new TmVpcbaseStack(this, `TmVpc${regionName}Stack`, {
        env: env,
        range: regionProps.vpc.range,
      });
      stacks[regionName] = { vpc } ;

      const bastion = new BastionStack(this, `TmBastion${regionName}Stack`, {
        vpc: vpc.vpc,
        env: env,
        crossRegionReferences: true,
      });
      stacks[regionName].bastion = bastion;

      const s3 = new TmS3Stack(this, `TmS3${regionName}Stack`, {
        env: env,
      });
      stacks[regionName].s3 = s3;
      
      let rds: TmRdsAuroraMysqlServerlessStack | TmRdsNetworkSecondaryRegionStack;
      if (regionProps.rds.isRdsMainRegion) {
        rds = new TmRdsAuroraMysqlServerlessStack(this, `TmRdsAurora${regionName}`, {
          env: env,
          vpc: vpc.vpc,
          bastionHost: bastion.securityGroupBastion,
          enableGlobal: true,
        });
        cdk.Aspects.of(rds).add(new AwsSolutionsChecks());
        NagSuppressions.addStackSuppressions(rds, [
          { id: 'AwsSolutions-SMG4', reason: 'The secret does not have automatic rotation scheduled.' },
          { id: 'AwsSolutions-RDS6', reason: 'The RDS Aurora MySQL/PostgresSQL cluster does not have IAM Database Authentication enabled.' },
          { id: 'AwsSolutions-RDS10', reason: 'AwsSolutions-RDS10: The RDS instance or Aurora DB cluster does not have deletion protection enabled.' },
          { id: 'AwsSolutions-RDS11', reason: 'The RDS instance or Aurora DB cluster uses the default endpoint port.' },
          { id: 'AwsSolutions-RDS14', reason: 'The RDS Aurora MySQL cluster does not have Backtrack enabled.' },
          { id: 'AwsSolutions-IAM4', reason: 'The IAM user, role, or group uses AWS managed policies.' },
        ]);
        stacks[regionName].rds = rds;
      } else {
        rds = new TmRdsNetworkSecondaryRegionStack(this, `TmRdsNetwork${regionName}Stack`, {
          env: env,
          vpc: vpc.vpc,
          bastionHost: bastion.securityGroupBastion,
        });
        stacks[regionName].rds = rds;
        cdk.Aspects.of(rds).add(new AwsSolutionsChecks());
      }

      if (regionProps.elasticache!.isRedisGlobalReplication) {
        const redis = new TmRedisGlobalStack(this, `TmRedisGlobal${regionName}Stack`, {
          env: env,
          vpc: vpc.vpc,
          crossRegionReferences: true,
          allowFromConstructs: { bastion: bastion.securityGroupBastion },
        });
        stacks[regionName].redis = redis;
        //console.log(redisGlobal.globalReplicationGroupId);
        cdk.Aspects.of(redis).add(new AwsSolutionsChecks());
        NagSuppressions.addStackSuppressions(redis, [
          { id: 'AwsSolutions-AEC3', reason: 'It does not have both encryption in transit and at rest enabled.' },
          { id: 'AwsSolutions-AEC4', reason: 'It not deployed in a Multi-AZ configuration.' },
          { id: 'AwsSolutions-AEC5', reason: 'It uses the default endpoint port.' },
          { id: 'AwsSolutions-AEC6', reason: 'It does not use Redis AUTH for user authentication.' },
        ]);
        mainRegionRedisProps.globalReplicationGroupId = redis.globalReplicationGroupId;
      } else {
        if (mainRegionRedisProps.globalReplicationGroupId) {
          const redis = new TmRedisStack(this, `TmRedis${regionName}Stack`, {
            env: env,
            vpc: vpc.vpc,
            crossRegionReferences: true,
            globalReplicationGroupId: mainRegionRedisProps.globalReplicationGroupId,
            allowFromConstructs: { bastion: bastion.securityGroupBastion },
          });
          stacks[regionName].redis = redis;
          cdk.Aspects.of(redis).add(new AwsSolutionsChecks());
          NagSuppressions.addStackSuppressions(redis, [
            { id: 'AwsSolutions-AEC3', reason: 'It does not have both encryption in transit and at rest enabled.' },
            { id: 'AwsSolutions-AEC4', reason: 'It not deployed in a Multi-AZ configuration.' },
            { id: 'AwsSolutions-AEC5', reason: 'It uses the default endpoint port.' },
            { id: 'AwsSolutions-AEC6', reason: 'It does not use Redis AUTH for user authentication.' },
          ]);
        }
      }

      const ecsStackProps: TmEcsStackProps = {
        env: env,
        vpc: vpc.vpc,
        crossRegionReferences: regionProps.ecs.crossRegionReferences,
        buildContextPath: regionProps.ecs.buildContextPath,
        buildDockerfile: regionProps.ecs.buildDockerfile,
        applicationName: regionProps.ecs.applicationName,
        hostedZoneIdParameterName: regionProps.ecs.hostedZoneIdParameterName,
        customHttpHeaderParameterName: regionProps.ecs.customHttpHeaderParameterName,
        domainParameterName: regionProps.ecs.domainParameterName,
        secretsFromSsmParameterStore: regionProps.ecs.secretsFromSsmParameterStore,
        additionalSecretsFromParameterStore: regionProps.ecs.additionalSecretsFromParameterStore,
      }

      const ecs = new TmEcsStack(this, `TmEcs${regionName}Stack`, ecsStackProps);
      ecs.addDependency(rds);
      stacks[regionName].ecs = ecs;

      cdk.Aspects.of(vpc).add(new AwsSolutionsChecks());
      cdk.Aspects.of(bastion).add(new AwsSolutionsChecks());
      NagSuppressions.addStackSuppressions(bastion, [
        { id: 'AwsSolutions-IAM5', reason: 'The IAM entity contains wildcard permissions.' },
        { id: 'AwsSolutions-EC26', reason: 'EBS volumes that have encryption disabled.' },
        { id: 'AwsSolutions-EC28', reason: 'The EC2 instance does not have detailed monitoring enabled.' },
        { id: 'AwsSolutions-EC29', reason: 'The EC2 instance does not have termination protection enabled.' },
      ]);
      cdk.Aspects.of(ecs).add(new AwsSolutionsChecks());
      NagSuppressions.addStackSuppressions(ecs, [
        { id: 'AwsSolutions-IAM5', reason: 'The IAM entity contains wildcard permissions.' },
        { id: 'AwsSolutions-IAM4', reason: 'The IAM user, role, or group uses AWS managed policies.' },
        { id: 'AwsSolutions-L1', reason: 'The non-container Lambda function is not configured to use the latest runtime version.' },
        { id: 'AwsSolutions-ELB2', reason: 'The ELB does not have access logs enabled.' },
        { id: 'AwsSolutions-ECS4', reason: 'The ECS Cluster has CloudWatch Container Insights disabled.' },
      ]);
    });

    const appLoadbalancersDnsNames: string[] = Object.values(stacks)
    .map(region => region.ecs?.loadbalancer.loadBalancerDnsName)
    .filter((dnsName): dnsName is string => dnsName !== undefined);

    const errorBuckets: s3.Bucket[] = Object.values(stacks)
    .map(region => region.s3?.errorBucket)
    .filter((bucket): bucket is s3.Bucket => bucket !== undefined);

    const contentBuckets: s3.Bucket[] = Object.values(stacks)
    .map(region => region.s3?.contentBucket)
    .filter((bucket): bucket is s3.Bucket => bucket !== undefined);

    const logBuckets: s3.Bucket[] = Object.values(stacks)
    .map(region => region.s3?.logBucket)
    .filter((bucket): bucket is s3.Bucket => bucket !== undefined);

    const cloudfrontEnv = {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1',
    };

    const cloudfrontStackProps: TmCloudfrontStackProps = {
      env: cloudfrontEnv,
      crossRegionReferences: true,
      retainLogBuckets: false,
      errorBuckets: errorBuckets,
      logBuckets: logBuckets,
      applicationLoadbalancersDnsNames: appLoadbalancersDnsNames,
      hostedZoneIdParameterName: '/cloudfrontStack/parameters/hostedZoneId',
      customHttpHeaderParameterName: '/cloudfrontStack/parameters/customHttpHeader',
      domainParameterName: '/cloudfrontStack/parameters/domanName',
      basicAuthEnabled: true,
      basicAuthBase64: '/cloudfrontStack/parameters/basicAuthBase64',
    }

    const cloudfront = new TmCloudfrontStack(this, 'TmCloudfrontUsEast1Stack', cloudfrontStackProps);
    stacks['us-east-1'] = { cloudfront };

    cdk.Aspects.of(cloudfront).add(new AwsSolutionsChecks());
    NagSuppressions.addStackSuppressions(cloudfront, [
      { id: 'AwsSolutions-S1', reason: 'The S3 Bucket has server access logs disabled.' },
      { id: 'AwsSolutions-S10', reason: 'The S3 Bucket or bucket policy does not require requests to use SSL.'},
      { id: 'AwsSolutions-IAM4', reason: 'The IAM user, role, or group uses AWS managed policies.'},
      { id: 'AwsSolutions-IAM5', reason: ' The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission.'},
      { id: 'AwsSolutions-L1', reason: 'The non-container Lambda function is not configured to use the latest runtime version.' },
    ]);

    const cloudfrontCdnStackProps: TmCloudfrontCdnStackProps = {
      env: cloudfrontEnv,
      crossRegionReferences: true,
      hostedZoneIdParameterName: '/cloudfrontStack/parameters/hostedZoneId',
      domainParameterName: '/cloudfrontCdnStack/parameters/domanName',
      contentBuckets: contentBuckets,
      errorBuckets: errorBuckets,
    }

    const cloudfrontCdn = new TmCloudfrontCdnStack(this, 'TmCloudfrontCdnUsEast1Stack', cloudfrontCdnStackProps);
    stacks['us-east-1'] = { cloudfrontCdn };

    cdk.Aspects.of(cloudfrontCdn).add(new AwsSolutionsChecks());
    NagSuppressions.addStackSuppressions(cloudfrontCdn, [
      { id: 'AwsSolutions-S1', reason: 'The S3 Bucket has server access logs disabled.' },
      { id: 'AwsSolutions-S10', reason: 'The S3 Bucket or bucket policy does not require requests to use SSL.'},
      { id: 'AwsSolutions-CFR3', reason: 'The CloudFront distribution does not have access logs enabled.'},
      { id: 'AwsSolutions-IAM4', reason: 'The IAM user, role, or group uses AWS managed policies.'},
      { id: 'AwsSolutions-IAM5', reason: ' The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission.'},
      { id: 'AwsSolutions-L1', reason: 'The non-container Lambda function is not configured to use the latest runtime version.' },
    ]);


    
    Object.entries(regions).forEach(([region]) => {
      
      const env = {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: region,
      };
      
      const regionName = toPascalCase(region);
      const contentBuckets = stacks[regionName].s3!.contentBucket.bucketArn;
      
      const iamUsersProps: TmServiceIamUsersStackProps = { 
        env: env,
        crossRegionReferences: true,
        contentBucketArn: contentBuckets,
        cloudfrontDistributionId: cloudfront.distribution.distributionId,
      }
  
      const iamUsers = new TmServiceIamUsersStack(this, `TmServiceIamUser${regionName}Stack`, iamUsersProps);
      stacks[regionName].iam = iamUsers;
  
      cdk.Aspects.of(iamUsers).add(new AwsSolutionsChecks());
      
    });

  }

}
