import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import { TmRdsAuroraMysqlServerless, TmVpcBase } from '../src';


test('TmRsAuroraMysqlServerless Construct creates a RDS Stack with a GlobalCluster', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  const vpc = new TmVpcBase(stack, 'TestVPC', {
    rangeCidr: '10.0.0.0/16',
    maxAzs: 2,
  });

  new TmRdsAuroraMysqlServerless(stack, 'Database', {
    engine: rds.DatabaseClusterEngine.auroraMysql({
      version: rds.AuroraMysqlEngineVersion.VER_3_05_2,
    }),
    vpc: vpc,
    enableGlobal: true,
  });


});
