import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { TmVpcbaseStack } from './tm-vpc-base-stack';
import { BastionStack } from './tm-bastion-stack';
//import { TmEcsStack, TmEcsStackProps } from './tm-ecs-stack';
//import { TmCloudfrontStack, TmCloudfrontStackProps } from './tm-cloudfront-stack';
import { TmRdsNetworkSecondaryRegionStack } from './tm-rds-network-secondary-region';
import { TmRdsAuroraMysqlServerlessStack } from './tm-rds-aurora-mysql-serverless-stack';

interface RegionParameters {
  range: string;
  rdsMainRegion: boolean;
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

      const regions: { [region: string]: RegionParameters } = {
        'ca-central-1': {
          range: '10.3.0.0/16',
          rdsMainRegion: true,
        },
        'eu-west-3': {
          range: '10.4.0.0/16',
          rdsMainRegion: false,
        }
      }
      
      Object.entries(regions).forEach(([region, regionProps]) => {
        const env = {
          account: process.env.CDK_DEFAULT_ACCOUNT,
          region: region,
        };

        const vpc = new TmVpcbaseStack(this, toPascalCase(`TmVpc${region}Stack`), {
          env: env,
          range: regionProps.range,
        });
        const bastion = new BastionStack(this, toPascalCase(`TmBastion${region}Stack`), {
          vpc: vpc.vpc,
          env: env,
        });
        if (regionProps.rdsMainRegion) {
          new TmRdsAuroraMysqlServerlessStack(this, toPascalCase(`TmRdsAurora${region}`), {
            env: env,
            vpc: vpc.vpc,
            bastionHost: bastion.securityGroupBastion,
            enableGlobal: true,
          });
        } else {
          new TmRdsNetworkSecondaryRegionStack(this, toPascalCase(`TmRdsNetwork${region}Stack`), {
            env: env,
            vpc: vpc.vpc,
            bastionHost: bastion.securityGroupBastion,
          });
        }
      });

     
    }

}
