import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { TmVpcbaseStack } from './tm-vpc-base-stack';
import { BastionStack } from './tm-bastion-stack';
import { TmEcsStack, TmEcsStackProps } from './tm-ecs-stack';
//import { TmCloudfrontStack, TmCloudfrontStackProps } from './tm-cloudfront-stack';
import { TmRdsNetworkSecondaryRegionStack } from './tm-rds-network-secondary-region';
import { TmRdsAuroraMysqlServerlessStack } from './tm-rds-aurora-mysql-serverless-stack';
import { TmRedisGlobalStack } from './tm-redis-global-stack';
import { TmRedisStack } from './tm-redis-stack';
import { NagSuppressions, AwsSolutionsChecks } from 'cdk-nag';
import * as path from 'path';

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
  }
  elasticache?: {
    isRedisGlobalReplication?: boolean;
  }
}

interface MainRegionRedisProps {
  globalReplicationGroupId?: string;
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
      
        const bastion = new BastionStack(this, `TmBastion${regionName}Stack`, {
          vpc: vpc.vpc,
          env: env,
          crossRegionReferences: true,
        });
      
        const ecsStackProps: TmEcsStackProps = {
          env: env,
          vpc: vpc.vpc,
          crossRegionReferences: regionProps.ecs.crossRegionReferences,
          buildContextPath: regionProps.ecs.buildContextPath,
          buildDockerfile: regionProps.ecs.buildDockerfile
        }
    
        const ecs = new TmEcsStack(this, `TmEcs${regionName}Stack`, ecsStackProps);

        if (regionProps.rds.isRdsMainRegion) {
          const rds = new TmRdsAuroraMysqlServerlessStack(this, `TmRdsAurora${regionName}`, {
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
        } else {
          const rds = new TmRdsNetworkSecondaryRegionStack(this, `TmRdsNetwork${regionName}Stack`, {
            env: env,
            vpc: vpc.vpc,
            bastionHost: bastion.securityGroupBastion,
          });
          cdk.Aspects.of(rds).add(new AwsSolutionsChecks());
        }
        if (regionProps.elasticache!.isRedisGlobalReplication) {
          const redisGlobal = new TmRedisGlobalStack(this, `TmRedisGlobal${regionName}Stack`, {
            env: env,
            vpc: vpc.vpc,
            crossRegionReferences: true,
          });
          console.log(redisGlobal.globalReplicationGroupId);
          cdk.Aspects.of(redisGlobal).add(new AwsSolutionsChecks());
          NagSuppressions.addStackSuppressions(redisGlobal, [
            { id: 'AwsSolutions-AEC3', reason: 'It does not have both encryption in transit and at rest enabled.' },
            { id: 'AwsSolutions-AEC4', reason: 'It not deployed in a Multi-AZ configuration.' },
            { id: 'AwsSolutions-AEC5', reason: 'It uses the default endpoint port.' },
            { id: 'AwsSolutions-AEC6', reason: 'It does not use Redis AUTH for user authentication.' },
          ]);
          mainRegionRedisProps.globalReplicationGroupId = redisGlobal.globalReplicationGroupId;
        } else {
          if (mainRegionRedisProps.globalReplicationGroupId) {
            const redis = new TmRedisStack(this, `TmRedis${regionName}Stack`, {
              env: env,
              vpc: vpc.vpc,
              crossRegionReferences: true,
              globalReplicationGroupId: mainRegionRedisProps.globalReplicationGroupId,
            });
            cdk.Aspects.of(redis).add(new AwsSolutionsChecks());
            NagSuppressions.addStackSuppressions(redis, [
              { id: 'AwsSolutions-AEC3', reason: 'It does not have both encryption in transit and at rest enabled.' },
              { id: 'AwsSolutions-AEC4', reason: 'It not deployed in a Multi-AZ configuration.' },
              { id: 'AwsSolutions-AEC5', reason: 'It uses the default endpoint port.' },
              { id: 'AwsSolutions-AEC6', reason: 'It does not use Redis AUTH for user authentication.' },
            ]);
          }
        }

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
    }

}
