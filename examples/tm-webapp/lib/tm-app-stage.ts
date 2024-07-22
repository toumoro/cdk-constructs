import * as cdk from 'aws-cdk-lib';
import { Construct } from "constructs";
import { TmVpcbaseStack } from './tm-vpc-base-stack';
import { BastionStack } from './tm-bastion-stack';
//import { TmEcsStack, TmEcsStackProps } from './tm-ecs-stack';
//import { TmCloudfrontStack, TmCloudfrontStackProps } from './tm-cloudfront-stack';
import { TmRdsNetworkSecondaryRegionStack } from './tm-rds-network-secondary-region';
import { TmRdsAuroraMysqlServerlessStack } from './tm-rds-aurora-mysql-serverless-stack';

interface RegionParameters {
  vpc: {
    range: string;
  }
  rds: {
    rdsMainRegion: boolean;
  }
}

export class TmPipelineAppStage extends cdk.Stage {

    constructor(scope: Construct, id: string, props?: cdk.StageProps) {
      super(scope, id, props);

      function toPascalCase(input: string): string {
        return input
            .split(/[\s_\-]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            //.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
      }

      const regions: { [region: string]: RegionParameters } = {
        'ca-central-1': {
          vpc: {
            range: '10.3.0.0/16',
          },
          rds: {
            rdsMainRegion: true,
          }
        },
        'eu-west-3': {
          vpc: {
            range: '10.4.0.0/16',
          },
          rds: {
            rdsMainRegion: false,
          }
        }
      }
      
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
        });
        if (regionProps.rds.rdsMainRegion) {
          new TmRdsAuroraMysqlServerlessStack(this, `TmRdsAurora${regionName}`, {
            env: env,
            vpc: vpc.vpc,
            bastionHost: bastion.securityGroupBastion,
            enableGlobal: true,
          });
        } else {
          new TmRdsNetworkSecondaryRegionStack(this, `TmRdsNetwork${regionName}Stack`, {
            env: env,
            vpc: vpc.vpc,
            bastionHost: bastion.securityGroupBastion,
          });
        }
      });

     
    }

}
