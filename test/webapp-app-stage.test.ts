import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  ContainerTopology,
  EnvironmentParameters,
  FalStorage,
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
