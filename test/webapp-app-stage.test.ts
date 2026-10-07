import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  ContainerTopology,
  EnvironmentParameters,
  FalStorage,
  PipelineSourceType,
  ServiceIamUser,
  TmEnvironmentParameters,
  TmParameterNames,
  TmPipelineStack,
  TmWebappAppStage,
} from '../src';

const ACCOUNT = '111111111111';
const buildContextPath = path.join(__dirname, 'fixtures', 'webapp');

/** Same shape as epq's settings. */
const greenfield: EnvironmentParameters = {
  account: ACCOUNT,
  environmentName: 'prod',
  vpc: { cidr: '10.3.0.0/16', hostedZoneName: 'example-site-web.internal' },
  rds: { instanceType: 't3.medium', performanceInsights: false },
  ecs: {
    secretsFromSsmParameterStore: ['TM_DOMAINS_LIST', 'TYPO3_CONTEXT'],
  },
  fal: { storage: FalStorage.S3 },
  serviceIamUsers: [ServiceIamUser.S3, ServiceIamUser.CLOUDFRONT],
  cloudfront: { domains: ['www.example.com'] },
  cdn: { domain: 'cdn.example.com' },
  waf: {},
  redirections: { amiId: 'ami-0123456789abcdef0' },
};

function context() {
  return {
    [`availability-zones:account=${ACCOUNT}:region=ca-central-1`]: ['ca-central-1a', 'ca-central-1b', 'ca-central-1d'],
  };
}

function synthStage(parameters: EnvironmentParameters): TmWebappAppStage {
  const app = new cdk.App({ context: context() });
  return new TmWebappAppStage(app, 'AppStage', {
    env: { account: ACCOUNT, region: 'ca-central-1' },
    parameters,
    buildContextPath,
  });
}

describe('TmWebappAppStage, greenfield settings', () => {
  const stage = synthStage(greenfield);

  test('keeps the fleet stack ids', () => {
    expect(stage.vpcStack.node.id).toBe('TmVpcCaCentral1Stack');
    expect(stage.bastionStack.node.id).toBe('TmBastionCaCentral1Stack');
    expect(stage.rdsStack.node.id).toBe('TmRdsAuroraCaCentral1');
    expect(stage.redisStack.node.id).toBe('TmRedisCaCentral1Stack');
    expect(stage.ecsStack.node.id).toBe('TmEcsCaCentral1Stack');
    expect(stage.backupStack.node.id).toBe('TmBackupCaCentral1Stack');
    expect(stage.cloudfrontStack?.node.id).toBe('TmCloudfrontCaCentral1Stack');
    expect(stage.redirectionsStack?.node.id).toBe('TmRedirectionsEc2CaCentral1Stack');
    expect(stage.wafStack?.region).toBe('us-east-1');
  });

  test('stacks only reference each other through SSM', () => {
    for (const stack of [stage.bastionStack, stage.rdsStack, stage.redisStack, stage.ecsStack, stage.cloudfrontStack!, stage.cdnStack!]) {
      expect(JSON.stringify(Template.fromStack(stack).toJSON())).not.toContain('Fn::ImportValue');
    }
  });

  test('deploys in dependency order', () => {
    const deps = (stack: cdk.Stack) => stack.dependencies.map(d => d.node.id);
    expect(deps(stage.ecsStack)).toEqual(expect.arrayContaining([
      'TmRdsAuroraCaCentral1', 'TmRedisCaCentral1Stack', 'TmS3CaCentral1Stack', 'TmServiceIamUsersCaCentral1Stack',
    ]));
    expect(deps(stage.cloudfrontStack!)).toEqual(expect.arrayContaining(['TmEcsCaCentral1Stack', 'TmWafUsEast1Stack']));
    expect(deps(stage.cdnStack!)).toEqual(expect.arrayContaining(['TmCloudfrontCaCentral1Stack']));
  });

  test('runs tm-apache and tm-php-fpm in one task', () => {
    const template = Template.fromStack(stage.ecsStack);
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '1024',
      Memory: '2048',
      Volumes: Match.arrayWith([{ Name: 'shared-ca' }]),
      ContainerDefinitions: [
        Match.objectLike({
          Name: 'web',
          Cpu: 256,
          Memory: 409,
          EntryPoint: ['/bin/sh', '-c'],
          Command: ['echo "127.0.0.1 php-fpm" >> /etc/hosts && exec /usr/local/bin/run.sh'],
          DependsOn: [{ ContainerName: 'php-fpm', Condition: 'START' }],
          MountPoints: Match.arrayWith([
            { ContainerPath: '/var/www/public/typo3temp/assets', SourceVolume: 'assets', ReadOnly: false },
            { ContainerPath: '/mnt/shared-ca', SourceVolume: 'shared-ca', ReadOnly: false },
          ]),
        }),
        Match.objectLike({
          Name: 'php-fpm',
          Cpu: 768,
          Memory: 1639,
          PortMappings: [Match.objectLike({ ContainerPort: 9000 })],
          Environment: [
            { Name: 'TM_S3ASSETS_REGION', Value: 'ca-central-1' },
            { Name: 'TM_S3ASSETS_DOMAIN', Value: 'cdn.example.com' },
            { Name: 'TM_PHP_FPM_TOTAL_RAM_MB', Value: '1639' },
          ],
          MountPoints: Match.arrayWith([
            { ContainerPath: '/var/www/public/typo3temp/assets', SourceVolume: 'assets', ReadOnly: false },
          ]),
        }),
      ],
    });
  });

  test('runs the scheduler and the deployment hook in php-fpm', () => {
    const template = Template.fromStack(stage.ecsStack);
    template.hasResourceProperties('AWS::Events::Rule', {
      Targets: [Match.objectLike({
        Input: Match.serializedJson(Match.objectLike({
          containerOverrides: [{ name: 'php-fpm', command: ['/usr/local/bin/run-scheduler.sh'] }],
        })),
      })],
    });
    const hook = Object.values(template.findResources('AWS::Lambda::Function')).find(r =>
      JSON.stringify(r).includes('ECS deployment hook triggered'));
    expect(JSON.stringify(hook)).toContain("const containerName = 'php-fpm'");
  });

  test('passes the stage outputs to the containers', () => {
    const template = Template.fromStack(stage.ecsStack);
    const taskDefinition = Object.values(template.findResources('AWS::ECS::TaskDefinition'))[0];
    const fpm = taskDefinition.Properties.ContainerDefinitions[1];
    const names = fpm.Secrets.map((s: { Name: string }) => s.Name).sort();
    expect(names).toEqual([
      'TM_DATABASE_WRITER_HOSTNAME',
      'TM_DOMAINS_LIST',
      'TM_REDIS_HOSTNAME',
      'TM_S3ASSETS_ACCESS_KEY_ID',
      'TM_S3ASSETS_BUCKET_NAME',
      'TM_S3ASSETS_SECRET_KEY',
      'TYPO3_CONTEXT',
    ]);
    const accessKey = fpm.Secrets.find((s: { Name: string }) => s.Name === 'TM_S3ASSETS_ACCESS_KEY_ID');
    expect(JSON.stringify(accessKey.ValueFrom)).toContain(':AccessKeyId::');
  });

  test('lets CloudFront, the bastion and ECS reach what they need', () => {
    const template = Template.fromStack(stage.ecsStack);
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', { FromPort: 3306, Description: 'Allow from Fargate Service' });
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', { FromPort: 6379, Description: 'Allow from Fargate Service' });
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', { FromPort: 2049, Description: 'Allow from bastion' });
    template.hasResourceProperties('AWS::SSM::Parameter', { Name: TmParameterNames.ecsLoadBalancerDnsName('prod') });
  });

  test('publishes the distribution IDs as a JSON map, CDN included', () => {
    const template = Template.fromStack(stage.cdnStack!);
    const parameter = Object.values(template.findResources('AWS::SSM::Parameter'))
      .find(r => r.Properties.Name === TmParameterNames.cloudfrontDistributionIds('prod'));
    const value = JSON.stringify(parameter!.Properties.Value);
    expect(value).toContain('www.example.com');
    expect(value).toContain('cdn.example.com');
  });

  test('attaches the WebACL and retains the distributions', () => {
    const template = Template.fromStack(stage.cloudfrontStack!);
    template.hasResource('AWS::CloudFront::Distribution', {
      DeletionPolicy: 'Retain',
      Properties: {
        DistributionConfig: Match.objectLike({
          Aliases: ['www.example.com'],
          WebACLId: { Ref: Match.stringLikeRegexp('SsmParameterValuetmprodwafwebaclarn') },
          Logging: Match.objectLike({ Prefix: 'www/' }),
        }),
      },
    });
  });

  test('creates the baseline WebACL and publishes its ARN in the application region', () => {
    const template = Template.fromStack(stage.wafStack!);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'CLOUDFRONT',
      Rules: Match.arrayWith([Match.objectLike({ Name: 'Rate-limit-per-ip' })]),
    });
    const writer = JSON.stringify(Object.values(template.findResources('Custom::AWS'))[0].Properties.Create);
    expect(writer).toContain('PutParameterCommand');
    expect(writer).toContain('\\"region\\":\\"ca-central-1\\"');
  });

  test('stores service user keys in Secrets Manager', () => {
    const template = Template.fromStack(stage.serviceIamUsersStack!);
    template.resourceCountIs('AWS::IAM::User', 2);
    template.resourceCountIs('AWS::SecretsManager::Secret', 2);
    template.hasResource('AWS::IAM::AccessKey', { DeletionPolicy: 'Retain' });
  });

  test('pins the redirection AMI and retains its Elastic IP', () => {
    const template = Template.fromStack(stage.redirectionsStack!);
    template.hasResource('AWS::EC2::EIP', { DeletionPolicy: 'Retain' });
    expect(JSON.stringify(template.toJSON())).toContain('ami-0123456789abcdef0');
  });
});

describe('TmWebappAppStage, options', () => {
  test('the SINGLE topology keeps one web container', () => {
    const stage = synthStage({
      ...greenfield,
      ecs: { ...greenfield.ecs, containerTopology: ContainerTopology.SINGLE },
    });
    const template = Template.fromStack(stage.ecsStack);
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [Match.objectLike({ Name: 'web', EntryPoint: Match.absent() })],
    });
  });

  test('EFS FAL mounts the FAL directories and has no content bucket', () => {
    const stage = synthStage({
      ...greenfield,
      fal: { storage: FalStorage.EFS, efsDirectories: ['fileadmin', 'uploads'] },
      serviceIamUsers: [],
      cdn: undefined,
    });
    const template = Template.fromStack(stage.ecsStack);
    template.resourceCountIs('AWS::EFS::FileSystem', 3);
    expect(stage.s3Stack?.contentBucket).toBeUndefined();
  });

  test('cloudfrontIntegration passes the tm_cloudfront variables', () => {
    const stage = synthStage({ ...greenfield, ecs: { ...greenfield.ecs, cloudfrontIntegration: true } });
    const json = JSON.stringify(Template.fromStack(stage.ecsStack).toJSON());
    expect(json).toContain('TM_CLOUDFRONT_DISTRIBUTION_IDS');
    expect(json).toContain('TM_CLOUDFRONT_APISECRET');
  });

  test('solr opt-in creates the instance and wires the Solr variables into the task', () => {
    const stage = synthStage({ ...greenfield, solr: {} });
    expect(stage.solrStack?.node.id).toBe('TmSolrCaCentral1Stack');

    const solrTemplate = Template.fromStack(stage.solrStack!);
    solrTemplate.resourceCountIs('AWS::EC2::Instance', 1);
    solrTemplate.hasResourceProperties('AWS::SSM::Parameter', { Name: TmParameterNames.solrWriterEndpoint('prod') });
    solrTemplate.hasResourceProperties('AWS::SSM::Parameter', { Name: TmParameterNames.solrWriterPort('prod'), Value: '8983' });

    const ecsTemplate = Template.fromStack(stage.ecsStack);
    const taskDefinition = Object.values(ecsTemplate.findResources('AWS::ECS::TaskDefinition'))[0];
    const fpm = taskDefinition.Properties.ContainerDefinitions[1];
    const names = fpm.Secrets.map((s: { Name: string }) => s.Name);
    expect(names).toEqual(expect.arrayContaining(['TM_SOLR_WRITER_HOSTNAME', 'TM_SOLR_WRITER_PORT']));
    ecsTemplate.hasResourceProperties('AWS::EC2::SecurityGroupIngress', { FromPort: 8983, Description: 'Allow from Fargate Service' });
    expect(stage.ecsStack.dependencies.map(d => d.node.id)).toEqual(expect.arrayContaining(['TmSolrCaCentral1Stack']));
  });

  test('rejects a variable that is both a repository secret and a stage output', () => {
    expect(() => synthStage({
      ...greenfield,
      ecs: { secretsFromSsmParameterStore: ['TM_S3ASSETS_BUCKET_NAME'] },
    })).toThrow(/TM_S3ASSETS_BUCKET_NAME/);
  });

  test('rejects a CDN without S3 FAL', () => {
    expect(() => synthStage({ ...greenfield, fal: { storage: FalStorage.EFS }, serviceIamUsers: [] })).toThrow(/cdn/);
  });
});

describe('TmWebappAppStage, created certificates (createCertificate opt-in)', () => {
  test('creates a us-east-1 ACM certificate per www domain and the CDN domain, with DNS validation', () => {
    const stage = synthStage({
      ...greenfield,
      cloudfront: {
        domains: ['www.example.com', 'www2.example.com'],
        additionalDomains: { 'www.example.com': ['example.com'] },
        createCertificate: true,
      },
      cdn: { domain: 'cdn.example.com', createCertificate: true },
    });

    expect(stage.certificateStack?.node.id).toBe('TmCertificateUsEast1Stack');
    expect(stage.certificateStack?.region).toBe('us-east-1');

    const template = Template.fromStack(stage.certificateStack!);
    // One certificate per www domain (SANs on the first) + the CDN domain.
    template.resourceCountIs('AWS::CertificateManager::Certificate', 3);
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'www.example.com',
      SubjectAlternativeNames: ['example.com'],
      ValidationMethod: 'DNS',
    });
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'www2.example.com',
      ValidationMethod: 'DNS',
    });
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'cdn.example.com',
      ValidationMethod: 'DNS',
    });
    // Certificates are retained like the distributions.
    template.hasResource('AWS::CertificateManager::Certificate', { DeletionPolicy: 'Retain' });

    // Each ARN is published (cross-region custom resource) to the SSM parameter
    // the matching CloudFront stack reads, in the application region.
    const writers = Object.values(template.findResources('Custom::AWS'))
      .map(r => JSON.stringify(r.Properties.Create));
    const joined = writers.join('\n');
    expect(joined).toContain('PutParameterCommand');
    expect(joined).toContain(TmParameterNames.cloudfrontWwwCertificateArn('prod', 0));
    expect(joined).toContain(TmParameterNames.cloudfrontWwwCertificateArn('prod', 1));
    expect(joined).toContain(TmParameterNames.cloudfrontCdnCertificateArn('prod'));
    expect(joined).toContain('\\"region\\":\\"ca-central-1\\"');

    // The CloudFront/CDN stacks wait for the certificate stack so the ARN
    // parameter exists before they read it.
    expect(stage.cloudfrontStack!.dependencies.map(d => d.node.id)).toEqual(
      expect.arrayContaining(['TmCertificateUsEast1Stack']));
    expect(stage.cdnStack!.dependencies.map(d => d.node.id)).toEqual(
      expect.arrayContaining(['TmCertificateUsEast1Stack']));

    // The CloudFront stacks keep importing by ARN read from the shared SSM
    // parameter (created and imported paths converge).
    const www = JSON.stringify(Template.fromStack(stage.cloudfrontStack!).toJSON());
    expect(www).toContain('tmprodcloudfrontwwwcertificatearn');
    const cdn = JSON.stringify(Template.fromStack(stage.cdnStack!).toJSON());
    expect(cdn).toContain('tmprodcloudfrontcdncertificatearn');
  });

  test('default (no createCertificate) creates no certificate stack and imports by ARN', () => {
    const stage = synthStage(greenfield);
    expect(stage.certificateStack).toBeUndefined();
    // The www stack still imports the certificate from the shared SSM parameter.
    const www = JSON.stringify(Template.fromStack(stage.cloudfrontStack!).toJSON());
    expect(www).toContain('tmprodcloudfrontwwwcertificatearn');
    expect(www).not.toContain('AWS::CertificateManager::Certificate');
  });
});

describe('TmWebappAppStage, generated origin custom header (generateOriginCustomHeader opt-in)', () => {
  test('publishes one stable value and uses the identical literal in the ALB condition and the CloudFront header', () => {
    const stage = synthStage({
      ...greenfield,
      cloudfront: { domains: ['www.example.com'], generateOriginCustomHeader: true },
    });

    const parameterName = TmParameterNames.cloudfrontOriginCustomHeader('prod');

    // ECS publishes the generated literal to the shared parameter.
    const ecsTemplate = Template.fromStack(stage.ecsStack);
    const publishedParameter = Object.values(ecsTemplate.findResources('AWS::SSM::Parameter'))
      .find(r => r.Properties.Name === parameterName);
    expect(publishedParameter).toBeDefined();
    const generatedValue: string = publishedParameter!.Properties.Value;
    expect(typeof generatedValue).toBe('string');
    expect(generatedValue).toMatch(/^[0-9a-f]{48}$/);

    // The ALB listener condition carries that exact literal (not an unresolved
    // reference), so the load balancer only accepts CloudFront's requests.
    ecsTemplate.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Conditions: Match.arrayWith([
        Match.objectLike({
          Field: 'http-header',
          HttpHeaderConfig: Match.objectLike({
            HttpHeaderName: 'X-Custom-Header',
            Values: [generatedValue],
          }),
        }),
      ]),
    });

    // CloudFront reads the same published parameter (dynamic SSM reference), so
    // both consumers resolve to the identical value at deploy time.
    const www = JSON.stringify(Template.fromStack(stage.cloudfrontStack!).toJSON());
    expect(www).toContain('tmprodcloudfrontorigincustomheader');
  });

  test('the generated value is deterministic across synths (no churn)', () => {
    const value = (p: EnvironmentParameters) => {
      const stage = synthStage(p);
      const template = Template.fromStack(stage.ecsStack);
      const parameter = Object.values(template.findResources('AWS::SSM::Parameter'))
        .find(r => r.Properties.Name === TmParameterNames.cloudfrontOriginCustomHeader('prod'));
      return parameter!.Properties.Value as string;
    };
    const settings: EnvironmentParameters = {
      ...greenfield,
      cloudfront: { domains: ['www.example.com'], generateOriginCustomHeader: true },
    };
    expect(value(settings)).toBe(value(settings));
  });

  test('default (no generateOriginCustomHeader) reads the pre-seeded parameter and publishes none', () => {
    const stage = synthStage(greenfield);
    const parameterName = TmParameterNames.cloudfrontOriginCustomHeader('prod');
    const template = Template.fromStack(stage.ecsStack);
    // No SSM parameter named for the custom header is written by the ECS stack.
    const published = Object.values(template.findResources('AWS::SSM::Parameter'))
      .find(r => r.Properties.Name === parameterName);
    expect(published).toBeUndefined();
    // The ALB condition is the unresolved SSM reference, as before.
    const json = JSON.stringify(template.toJSON());
    expect(json).toContain('tmprodcloudfrontorigincustomheader');
  });
});

describe('TmPipelineStack', () => {
  test('deploys the stage then invalidates the distributions', () => {
    const app = new cdk.App({ context: context() });
    const pipeline = new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: greenfield,
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    });
    const json = JSON.stringify(Template.fromStack(pipeline).toJSON());
    expect(json).toContain("jq -r '.[]'");
    expect(json).toContain(TmParameterNames.cloudfrontDistributionIds('prod'));
    expect(pipeline.appStage.node.id).toBe('AppStage');
    expect(pipeline.crossRegionSupportStacks.map(stack => stack.region)).toEqual(['us-east-1']);
  });

  test('deploys the stacks added by the repository', () => {
    const app = new cdk.App({ context: context() });
    const pipeline = new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: { ...greenfield, waf: undefined },
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
      appStageExtension: {
        extend: (stage: TmWebappAppStage) => {
          const own = new cdk.Stack(stage, 'TmOwnCaCentral1Stack', { env: { account: ACCOUNT, region: 'ca-central-1' } });
          new cdk.CfnWaitConditionHandle(own, 'Handle');
          own.addStackDependency(stage.ecsStack);
        },
      },
    });
    const json = JSON.stringify(Template.fromStack(pipeline).toJSON());
    expect(json).toContain('AppStage-TmOwnCaCentral1Stack');
    expect(pipeline.crossRegionSupportStacks).toEqual([]);
  });

  test('default source is CodeCommit and creates no S3 source buckets', () => {
    const app = new cdk.App({ context: context() });
    const pipeline = new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: greenfield,
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    });
    const template = Template.fromStack(pipeline);
    // The pipeline source is CodeCommit, not S3.
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: 'Source',
          Actions: Match.arrayWith([
            Match.objectLike({ ActionTypeId: Match.objectLike({ Provider: 'CodeCommit' }) }),
          ]),
        }),
      ]),
    });
    // No OIDC upload role and no stack outputs on the CodeCommit path.
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toContain('token.actions.githubusercontent.com');
    expect(Object.keys(template.findOutputs('*'))).toEqual([]);
    // No S3-source EventBridge rule (matching source.zip object-created).
    expect(json).not.toContain('source.zip');
  });

  test('S3 source creates the buckets, OIDC role, EventBridge triggers and outputs', () => {
    const app = new cdk.App({ context: context() });
    const pipeline = new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: {
        ...greenfield,
        pipeline: {
          sourceType: PipelineSourceType.S3,
          infrastructureGithubRepo: 'toumoro/example-infra',
          applicationGithubRepo: 'toumoro/example-app',
          sourceBranch: 'prod',
        },
      },
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    });
    const template = Template.fromStack(pipeline);

    // (a) two versioned source buckets, each with EventBridge notifications
    // enabled (rendered as the S3BucketNotifications custom resource). The
    // pipeline's own artifact bucket is not versioned, so this is exactly 2.
    const sourceBuckets = template.findResources('AWS::S3::Bucket', {
      Properties: Match.objectLike({ VersioningConfiguration: { Status: 'Enabled' } }),
    });
    expect(Object.keys(sourceBuckets)).toHaveLength(2);
    template.resourceCountIs('Custom::S3BucketNotifications', 2);

    // (b) OIDC role: GitHub federated principal, both repos + branch in the sub.
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
              StringLike: {
                'token.actions.githubusercontent.com:sub': [
                  'repo:toumoro/example-infra:ref:refs/heads/prod',
                  'repo:toumoro/example-app:ref:refs/heads/prod',
                ],
              },
            },
            Principal: {
              Federated: Match.objectLike({
                'Fn::Join': Match.arrayWith([
                  Match.arrayWith([Match.stringLikeRegexp('oidc-provider/token.actions.githubusercontent.com')]),
                ]),
              }),
            },
          }),
        ]),
      },
    });

    // (c) one EventBridge rule per source bucket, matching the source.zip upload.
    const sourceRules = template.findResources('AWS::Events::Rule', {
      Properties: Match.objectLike({
        EventPattern: Match.objectLike({
          'source': ['aws.s3'],
          'detail-type': ['Object Created'],
          'detail': { object: { key: [{ prefix: 'source.zip' }] } },
        }),
      }),
    });
    expect(Object.keys(sourceRules)).toHaveLength(2);

    // (d) outputs the consumer reads for its GitHub variables.
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toEqual(
      expect.arrayContaining(['GitHubActionsPipelineRoleArn', 'InfraSourceBucketName', 'AppSourceBucketName']));

    // The pipeline source is S3, not CodeCommit.
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toContain('"Provider":"CodeCommit"');
  });

  test('S3 source without the GitHub repos throws', () => {
    const app = new cdk.App({ context: context() });
    expect(() => new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: { ...greenfield, pipeline: { sourceType: PipelineSourceType.S3 } },
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    })).toThrow(/infrastructureGithubRepo/);
  });

  test('S3 source without sourceEnvironment trusts the branch subject (branch-mode regression)', () => {
    const app = new cdk.App({ context: context() });
    const pipeline = new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: {
        ...greenfield,
        pipeline: {
          sourceType: PipelineSourceType.S3,
          infrastructureGithubRepo: 'toumoro/example-infra',
          applicationGithubRepo: 'toumoro/example-app',
          sourceBranch: 'prod',
          // no sourceEnvironment
        },
      },
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    });
    const template = Template.fromStack(pipeline);
    const role = Object.values(template.findResources('AWS::IAM::Role')).find(r =>
      JSON.stringify(r).includes('token.actions.githubusercontent.com:sub'))!;
    const subs = role.Properties.AssumeRolePolicyDocument.Statement
      .flatMap((s: any) => s.Condition?.StringLike?.['token.actions.githubusercontent.com:sub'] ?? []);
    expect(subs).toEqual([
      'repo:toumoro/example-infra:ref:refs/heads/prod',
      'repo:toumoro/example-app:ref:refs/heads/prod',
    ]);
    // Branch mode never emits the environment subject.
    expect(JSON.stringify(subs)).not.toContain(':environment:');
  });

  test('S3 source with sourceEnvironment trusts the environment subject for both repos', () => {
    const app = new cdk.App({ context: context() });
    const pipeline = new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: {
        ...greenfield,
        pipeline: {
          sourceType: PipelineSourceType.S3,
          infrastructureGithubRepo: 'toumoro/example-infra',
          applicationGithubRepo: 'toumoro/example-app',
          sourceBranch: 'prod',
          sourceEnvironment: 'prod',
        },
      },
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    });
    const template = Template.fromStack(pipeline);
    const role = Object.values(template.findResources('AWS::IAM::Role')).find(r =>
      JSON.stringify(r).includes('token.actions.githubusercontent.com:sub'))!;
    const subs = role.Properties.AssumeRolePolicyDocument.Statement
      .flatMap((s: any) => s.Condition?.StringLike?.['token.actions.githubusercontent.com:sub'] ?? []);
    expect(subs).toEqual([
      'repo:toumoro/example-infra:environment:prod',
      'repo:toumoro/example-app:environment:prod',
    ]);
    // When the workflow runs under an environment, the branch subject must NOT
    // be trusted (the token never carries it).
    expect(JSON.stringify(subs)).not.toContain(':ref:refs/heads/');
  });
});

describe('TmEnvironmentParameters.select', () => {
  test('returns the entry of the account', () => {
    expect(TmEnvironmentParameters.select([greenfield], ACCOUNT)).toBe(greenfield);
  });

  test('lists the valid accounts when none matches', () => {
    expect(() => TmEnvironmentParameters.select([greenfield], '222222222222')).toThrow(/111111111111 \(prod\)/);
  });
});

describe('TmParameterNames', () => {
  test('follows /tm/<env>/<component>/<resource>/<attribute>', () => {
    expect(TmParameterNames.rdsWriterEndpoint('prod')).toBe('/tm/prod/rds/cluster/writer-endpoint');
    expect(TmParameterNames.cloudfrontWwwDistributionId('prod', 1)).toBe('/tm/prod/cloudfront/www-2/distribution-id');
  });

  test('rejects segments that are not kebab-case', () => {
    expect(() => TmParameterNames.of('Prod', 'rds', 'cluster', 'arn')).toThrow(/lower-kebab-case/);
  });
});
