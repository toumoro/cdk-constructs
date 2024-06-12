import * as cdk from 'aws-cdk-lib';
import { PipelineCdk } from '../src';


test('Pipeline Construct creates a Pipeline to CDK Deploy', () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  // Instantiate the VPC construct with a specific CIDR block
  new PipelineCdk(stack, 'MyVpc', {
    pipelineName: 'tm-test',
    repoName: 'toumoro/cdk-vpc-toumoro-app',
    repoBranch: 'main',
  });

});
