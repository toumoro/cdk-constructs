import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { HeadersFrameOption, HeadersReferrerPolicy } from 'aws-cdk-lib/aws-cloudfront';
import * as events from 'aws-cdk-lib/aws-events';
import {
  BackupResourceType,
  ContainerTopology,
  EnvironmentParameters,
  FalS3Driver,
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

/** Inbound 443 rules of the stack, inline or standalone. */
function https443Ingress(template: Template): any[] {
  const inline = Object.values(template.findResources('AWS::EC2::SecurityGroup'))
    .flatMap(sg => sg.Properties.SecurityGroupIngress ?? []);
  const standalone = Object.values(template.findResources('AWS::EC2::SecurityGroupIngress')).map(r => r.Properties);
  return [...inline, ...standalone].filter(rule => rule.FromPort === 443);
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
    // By default (fixEfsAssetsOwnership off) the hook command is unchanged:
    // the plain deployment-hook script, no chown wrapper.
    const hookCode = JSON.stringify(hook);
    expect(hookCode).toContain('/usr/local/bin/deployment-hook.sh');
    expect(hookCode).not.toContain('chown');
  });

  test('fixEfsAssetsOwnership prepends a chown of the EFS assets mount to the hook', () => {
    const stageWithChown = synthStage({
      ...greenfield,
      ecs: { ...greenfield.ecs, fixEfsAssetsOwnership: true },
    });
    const template = Template.fromStack(stageWithChown.ecsStack);
    const hook = Object.values(template.findResources('AWS::Lambda::Function')).find(r =>
      JSON.stringify(r).includes('ECS deployment hook triggered'));
    const hookCode = JSON.stringify(hook);
    expect(hookCode).toContain('chown -R 33:33 /var/www/public/typo3temp/assets');
    expect(hookCode).toContain('/usr/local/bin/deployment-hook.sh');
    expect(hookCode).toContain('/bin/sh');
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

  test('challenges hosting providers, except Site24x7, after the anonymous IP list labels them', () => {
    const rules: any[] = Object.values(Template.fromStack(stage.wafStack!).findResources('AWS::WAFv2::WebACL'))[0].Properties.Rules;
    const priority = (name: string) => rules.find(rule => rule.Name === name).Priority;
    expect(priority('AWS-AWSManagedRulesAnonymousIpList')).toBeLessThan(priority('Challenge-hosting-provider-not-site24x7'));
    const challenge = rules.find(rule => rule.Name === 'Challenge-hosting-provider-not-site24x7');
    expect(challenge.Action).toEqual({ Challenge: {} });
    expect(JSON.stringify(challenge.Statement)).toContain('awswaf:managed:aws:anonymous-ip-list:HostingProviderIPList');
    expect(JSON.stringify(challenge.Statement)).toContain('Site24x7');
    const antiDdos = rules.find(rule => rule.Name === 'AWS-AWSManagedRulesAntiDDoSRuleSet');
    expect(antiDdos.Statement.ManagedRuleGroupStatement.ManagedRuleGroupConfigs[0].AWSManagedRulesAntiDDoSRuleSet).toMatchObject({
      ClientSideActionConfig: { Challenge: { UsageOfAction: 'ENABLED', Sensitivity: 'HIGH' } },
      SensitivityToBlock: 'LOW',
    });
  });

  test('counts the body rules and blocks their matches outside the TYPO3 exceptions', () => {
    const rules: any[] = Object.values(Template.fromStack(stage.wafStack!).findResources('AWS::WAFv2::WebACL'))[0].Properties.Rules;
    const rule = (name: string) => rules.find(r => r.Name === name);
    const counted = (name: string) => rule(name).Statement.ManagedRuleGroupStatement.RuleActionOverrides.map((o: any) => o.Name);
    expect(counted('AWS-AWSManagedRulesSQLiRuleSet')).toEqual(['SQLi_BODY']);
    expect(counted('AWS-AWSManagedRulesPHPRuleSet')).toEqual(['PHPHighRiskMethodsVariables_BODY']);
    expect(rule('AWS-AWSManagedRulesSQLiRuleSet').Statement.ManagedRuleGroupStatement.ScopeDownStatement).toBeUndefined();
    const sqli = rule('TYPO3_SQLi_Body');
    expect(sqli.Priority).toBeGreaterThan(rule('AWS-AWSManagedRulesPHPRuleSet').Priority);
    expect(sqli.Action).toEqual({ Block: {} });
    expect(sqli.Statement.AndStatement.Statements[0].LabelMatchStatement.Key).toBe('awswaf:managed:aws:sql-database:SQLi_Body');
    expect(JSON.stringify(sqli.Statement)).toContain('/typo3/file/commit');
    expect(counted('AWS-AWSManagedRulesCommonRuleSet')).toContain('SizeRestrictions_QUERYSTRING');
    const queryString = rule('TYPO3_SizeRestrictions_QueryString');
    expect(queryString.Action).toEqual({ Block: {} });
    expect(queryString.Statement.AndStatement.Statements[0].LabelMatchStatement.Key)
      .toBe('awswaf:managed:aws:core-rule-set:SizeRestrictions_QueryString');
    expect(JSON.stringify(queryString.Statement.AndStatement.Statements[1].NotStatement)).toContain('/typo3/');
  });

  test('rate limits Solr searches per IP, and per IP and JA4 fingerprint', () => {
    const rules: any[] = Object.values(Template.fromStack(stage.wafStack!).findResources('AWS::WAFv2::WebACL'))[0].Properties.Rules;
    const rule = (name: string) => rules.find(r => r.Name === name);
    const block = rule('Rate-limit-solr-block');
    expect(block.Action.Block.CustomResponse).toEqual({ ResponseCode: 429, ResponseHeaders: [{ Name: 'Retry-After', Value: '60' }] });
    expect(block.Statement.RateBasedStatement).toMatchObject({ Limit: 300, EvaluationWindowSec: 60, AggregateKeyType: 'IP' });
    expect(block.Statement.RateBasedStatement.ScopeDownStatement.ByteMatchStatement.SearchString).toBe('tx_solr');
    expect(rule('Rate-limit-solr-challenge').Statement.RateBasedStatement.Limit).toBe(100);
    expect(rule('Rate-limit-solr-ja4-challenge').Statement.RateBasedStatement.CustomKeys)
      .toEqual([{ IP: {} }, { JA4Fingerprint: { FallbackBehavior: 'NO_MATCH' } }]);
    expect(rule('Challenge-solr-filter').Action).toEqual({ Challenge: {} });
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
  test('waf.ipRestrictedPaths blocks the path outside the allowed IPv4 and IPv6 ranges', () => {
    const stage = synthStage({
      ...greenfield,
      waf: { ipRestrictedPaths: [{ pathPrefix: '/typo3/', allowedCidrs: ['203.0.113.0/29', '198.51.100.7/32', '2001:db8::/32'] }] },
    });
    const template = Template.fromStack(stage.wafStack!);
    template.hasResourceProperties('AWS::WAFv2::IPSet', { Scope: 'CLOUDFRONT', IPAddressVersion: 'IPV4', Addresses: ['203.0.113.0/29', '198.51.100.7/32'] });
    template.hasResourceProperties('AWS::WAFv2::IPSet', { IPAddressVersion: 'IPV6', Addresses: ['2001:db8::/32'] });
    const rules: any[] = Object.values(template.findResources('AWS::WAFv2::WebACL'))[0].Properties.Rules;
    const restrict = rules.find(rule => rule.Name === 'Restrict-path-1');
    expect(restrict.Priority).toBeLessThan(rules.find(rule => rule.Name === 'AWS-AWSManagedRulesAntiDDoSRuleSet').Priority);
    expect(restrict.Action).toEqual({ Block: {} });
    const [pathMatch, notAllowed] = restrict.Statement.AndStatement.Statements;
    expect(pathMatch.ByteMatchStatement).toMatchObject({ SearchString: '/typo3/', PositionalConstraint: 'STARTS_WITH' });
    expect(pathMatch.ByteMatchStatement.TextTransformations.map((t: any) => t.Type)).toEqual(['URL_DECODE', 'LOWERCASE']);
    expect(notAllowed.NotStatement.Statement.OrStatement.Statements).toHaveLength(2);
  });

  test('waf.ipRestrictedPaths rejects more than four paths', () => {
    const restriction = { pathPrefix: '/typo3/', allowedCidrs: ['203.0.113.0/29'] };
    expect(() => synthStage({ ...greenfield, waf: { ipRestrictedPaths: [restriction, restriction, restriction, restriction, restriction] } })).toThrow(/at most 4/);
  });

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

describe('TmWebappAppStage, CloudFront VPC origin (vpcOrigin opt-in)', () => {
  const stage = synthStage({
    ...greenfield,
    cloudfront: {
      domains: ['www.example.com'],
      additionalDomains: { 'www.example.com': ['example.com'] },
      vpcOrigin: true,
    },
  });

  test('the load balancer is internal, in the private subnets, with an HTTPS listener and a certificate for the www domains', () => {
    const template = Template.fromStack(stage.ecsStack);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      Subnets: Match.arrayWith([Match.objectLike({ 'Fn::Select': [0, { 'Fn::Split': [',', { Ref: Match.stringLikeRegexp('tmprodvpcsubnetsprivateids') }] }] })]),
    });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
      SslPolicy: 'ELBSecurityPolicy-TLS13-1-2-2021-06',
      Certificates: [{ CertificateArn: { Ref: Match.stringLikeRegexp('LoadBalancerCertificate') } }],
    });
    template.hasResource('AWS::CertificateManager::Certificate', {
      DeletionPolicy: 'Retain',
      Properties: { DomainName: 'www.example.com', SubjectAlternativeNames: ['example.com'], ValidationMethod: 'DNS' },
    });
    // No public listener on 80.
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
  });

  test('with private tasks too, the public subnets are not imported at all', () => {
    const privateStage = synthStage({
      ...greenfield,
      ecs: { ...greenfield.ecs, tasksInPrivateSubnets: true },
      cloudfront: { domains: ['www.example.com'], vpcOrigin: true },
    });
    expect(JSON.stringify(Template.fromStack(privateStage.ecsStack).toJSON())).not.toContain('tmprodvpcsubnetspublicids');
  });

  test('the load balancer only accepts HTTPS from the CloudFront prefix list and still requires the origin header', () => {
    const template = Template.fromStack(stage.ecsStack);
    // VPC origin traffic does not carry VPC addresses: a CIDR rule would never match.
    const rules = https443Ingress(template);
    expect(rules.length).toBeGreaterThan(0);
    rules.forEach(rule => {
      expect(rule.SourcePrefixListId).toBeDefined();
      expect(rule.CidrIp).toBeUndefined();
    });
    expect(JSON.stringify(template.toJSON())).toContain('cloudfront.origin-facing');
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
      Conditions: Match.arrayWith([Match.objectLike({ Field: 'http-header' })]),
    });
  });

  test('publishes the load balancer ARN and DNS name for the CloudFront stack, which builds a VPC origin over HTTPS', () => {
    const ecsTemplate = Template.fromStack(stage.ecsStack);
    ecsTemplate.hasResourceProperties('AWS::SSM::Parameter', { Name: TmParameterNames.ecsVpcOriginLoadBalancerArn('prod') });
    ecsTemplate.hasResourceProperties('AWS::SSM::Parameter', { Name: TmParameterNames.ecsVpcOriginLoadBalancerDnsName('prod') });
    // No bridge unless asked.
    ecsTemplate.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);

    const template = Template.fromStack(stage.cloudfrontStack!);
    template.hasResourceProperties('AWS::CloudFront::VpcOrigin', {
      VpcOriginEndpointConfig: Match.objectLike({
        Name: Match.stringLikeRegexp('ServiceVpcOrigin'),
        Arn: { Ref: Match.stringLikeRegexp('tmprodecsvpcoriginloadbalancerarn') },
        HTTPSPort: 443,
        OriginProtocolPolicy: 'https-only',
        OriginSSLProtocols: ['TLSv1.2'],
      }),
    });
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Origins: [Match.objectLike({
          VpcOriginConfig: Match.objectLike({ VpcOriginId: Match.anyValue() }),
          OriginCustomHeaders: [Match.objectLike({ HeaderName: 'X-Custom-Header' })],
        })],
      }),
    });
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toContain('CustomOriginConfig');
    // The load balancer is not imported: only its ARN and DNS name are read.
    expect(json).not.toContain('security-group-id');
  });

  test('default (no vpcOrigin) keeps the public HTTP load balancer and the HTTP origin', () => {
    const base = synthStage(greenfield);
    const ecsTemplate = Template.fromStack(base.ecsStack);
    ecsTemplate.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', { Scheme: 'internet-facing' });
    ecsTemplate.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', { Port: 80, Protocol: 'HTTP' });
    ecsTemplate.resourceCountIs('AWS::CertificateManager::Certificate', 0);
    expect(JSON.stringify(ecsTemplate.toJSON())).toContain('cloudfront.origin-facing');
    // Tasks stay public by default (fleet behaviour).
    ecsTemplate.hasResourceProperties('AWS::ECS::Service', {
      NetworkConfiguration: { AwsvpcConfiguration: Match.objectLike({ AssignPublicIp: 'ENABLED' }) },
    });
    ecsTemplate.resourceCountIs('AWS::ApplicationAutoScaling::ScalingPolicy', 2);
    const www = Template.fromStack(base.cloudfrontStack!);
    www.resourceCountIs('AWS::CloudFront::VpcOrigin', 0);
    www.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Origins: [Match.objectLike({ CustomOriginConfig: Match.objectLike({ OriginProtocolPolicy: 'http-only' }) })],
      }),
    });
  });
});

describe('TmWebappAppStage, no-downtime migration to the VPC origin (vpcOriginBridge)', () => {
  const withDomains = { domains: ['www.example.com'], additionalDomains: { 'www.example.com': ['example.com'] } };

  test('step 1: the public load balancer stays, a bridge is added and becomes the VPC origin endpoint', () => {
    const stage = synthStage({
      ...greenfield,
      ecs: { ...greenfield.ecs, tasksInPrivateSubnets: true, disableMemoryScaling: true },
      cloudfront: { ...withDomains, vpcOriginBridge: true },
    });
    const ecs = Template.fromStack(stage.ecsStack);
    // Both load balancers: the pattern's public one, unchanged, and the internal bridge.
    ecs.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 2);
    ecs.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', { Scheme: 'internet-facing' });
    ecs.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Scheme: 'internal',
      SecurityGroups: [{ 'Fn::GetAtt': [Match.stringLikeRegexp('VpcOriginBridgeSecurityGroup'), 'GroupId'] }],
    });
    ecs.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', { Port: 80, Protocol: 'HTTP' });
    ecs.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
      Certificates: [{ CertificateArn: { Ref: Match.stringLikeRegexp('LoadBalancerCertificate') } }],
      LoadBalancerArn: { Ref: Match.stringLikeRegexp('VpcOriginBridge') },
    });
    // The service registers in both target groups; the bridge rule needs the header too.
    ecs.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 2);
    const service = Object.values(ecs.findResources('AWS::ECS::Service'))[0];
    expect(service.Properties.LoadBalancers).toHaveLength(2);
    expect(service.Properties.NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp).toBe('DISABLED');
    const rules = Object.values(ecs.findResources('AWS::ElasticLoadBalancingV2::ListenerRule'));
    expect(rules).toHaveLength(2);
    rules.forEach(rule => expect(JSON.stringify(rule)).toContain('X-Custom-Header'));
    ecs.resourceCountIs('AWS::ApplicationAutoScaling::ScalingPolicy', 1);
    // The VPC origin parameters point at the bridge.
    const parameters = Object.values(ecs.findResources('AWS::SSM::Parameter'));
    const arn = parameters.find(r => r.Properties.Name === TmParameterNames.ecsVpcOriginLoadBalancerArn('prod'))!;
    expect(JSON.stringify(arn.Properties.Value)).toContain('VpcOriginBridge');
    const dns = parameters.find(r => r.Properties.Name === TmParameterNames.ecsVpcOriginLoadBalancerDnsName('prod'))!;
    expect(JSON.stringify(dns.Properties.Value)).toContain('VpcOriginBridge');
    // The bridge only accepts CloudFront, not 0.0.0.0/0 (addListener's default).
    const bridgeRules = https443Ingress(ecs);
    expect(bridgeRules.length).toBeGreaterThan(0);
    bridgeRules.forEach(rule => expect(rule.SourcePrefixListId).toBeDefined());
    // CloudFront already uses the VPC origin.
    Template.fromStack(stage.cloudfrontStack!).resourceCountIs('AWS::CloudFront::VpcOrigin', 1);
  });

  test('step 2: the service load balancer becomes internal and the VPC origin endpoint while the bridge stays', () => {
    const stage = synthStage({
      ...greenfield,
      ecs: { ...greenfield.ecs, tasksInPrivateSubnets: true },
      cloudfront: { ...withDomains, vpcOrigin: true, vpcOriginBridge: true },
    });
    const ecs = Template.fromStack(stage.ecsStack);
    ecs.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 2);
    expect(JSON.stringify(ecs.toJSON())).not.toContain('internet-facing');
    const parameters = Object.values(ecs.findResources('AWS::SSM::Parameter'));
    const arn = parameters.find(r => r.Properties.Name === TmParameterNames.ecsVpcOriginLoadBalancerArn('prod'))!;
    expect(JSON.stringify(arn.Properties.Value)).toContain('servicePatternLB');
    expect(JSON.stringify(arn.Properties.Value)).not.toContain('VpcOriginBridge');
    // One certificate shared by both HTTPS listeners.
    ecs.resourceCountIs('AWS::CertificateManager::Certificate', 1);
  });

  test('step 1 to step 2 creates a new VPC origin instead of modifying the one in use', () => {
    const vpcOrigins = (cloudfront: object) => {
      const stage = synthStage({ ...greenfield, cloudfront: { ...withDomains, ...cloudfront } });
      return Template.fromStack(stage.cloudfrontStack!).findResources('AWS::CloudFront::VpcOrigin');
    };
    const step1 = vpcOrigins({ vpcOriginBridge: true });
    const step2 = vpcOrigins({ vpcOrigin: true, vpcOriginBridge: true });
    const step3 = vpcOrigins({ vpcOrigin: true });
    // CloudFront refuses to update a VPC origin associated with a distribution (409).
    expect(Object.keys(step1)).toEqual([expect.stringMatching(/^BridgeVpcOrigin/)]);
    expect(Object.keys(step2)).toEqual([expect.stringMatching(/^ServiceVpcOrigin/)]);
    expect(step3).toEqual(step2);
    const name = (resources: Record<string, any>) => Object.values(resources)[0].Properties.VpcOriginEndpointConfig.Name;
    expect(name(step1)).not.toEqual(name(step2));
    // Generated from the construct path: no collision between stages of one account.
    expect(name(step2)).toMatch(/^AppStage/);
    expect(name(step2).length).toBeLessThanOrEqual(64);
  });

  test('step 3: vpcOrigin alone removes the bridge', () => {
    const stage = synthStage({ ...greenfield, cloudfront: { ...withDomains, vpcOrigin: true } });
    const ecs = Template.fromStack(stage.ecsStack);
    ecs.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    expect(JSON.stringify(ecs.toJSON())).not.toContain('VpcOriginBridge');
  });
});

describe('TmWebappAppStage, target group health check', () => {
  test('ecs.healthCheck applies to the service target group and to the bridge', () => {
    const stage = synthStage({
      ...greenfield,
      ecs: { ...greenfield.ecs, healthCheck: { path: '/', healthyHttpCodes: '200-499', intervalSeconds: 15 } },
      cloudfront: { domains: ['www.example.com'], vpcOriginBridge: true },
    });
    const template = Template.fromStack(stage.ecsStack);
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 2);
    const groups = Object.values(template.findResources('AWS::ElasticLoadBalancingV2::TargetGroup'));
    for (const group of groups) {
      expect(group.Properties.HealthCheckPath).toBe('/');
      expect(group.Properties.Matcher).toEqual({ HttpCode: '200-499' });
      expect(group.Properties.HealthCheckIntervalSeconds).toBe(15);
      // Unset fields keep the ELB defaults.
      expect(group.Properties.HealthCheckTimeoutSeconds).toBeUndefined();
    }
  });

  test('default keeps the ELB health check untouched', () => {
    const template = Template.fromStack(synthStage(greenfield).ecsStack);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: Match.absent(),
      Matcher: Match.absent(),
      HealthCheckIntervalSeconds: Match.absent(),
    });
  });
});

describe('TmWebappAppStage, FAL S3 driver', () => {
  test('aus_driver_amazon_s3 with the S3 service user passes the TM_AUS_DRIVER_AMAZON_S3_* variables and keys', () => {
    const stage = synthStage({ ...greenfield, fal: { storage: FalStorage.S3, s3Driver: FalS3Driver.AUS_DRIVER_AMAZON_S3 } });
    const template = Template.fromStack(stage.ecsStack);
    const taskDefinition = Object.values(template.findResources('AWS::ECS::TaskDefinition'))[0];
    const fpm = taskDefinition.Properties.ContainerDefinitions[1];
    const secrets = fpm.Secrets.map((s: { Name: string }) => s.Name);
    expect(secrets).toEqual(expect.arrayContaining([
      'TM_AUS_DRIVER_AMAZON_S3_BUCKET', 'TM_AUS_DRIVER_AMAZON_S3_KEY', 'TM_AUS_DRIVER_AMAZON_S3_SECRET',
    ]));
    expect(fpm.Environment).toEqual(expect.arrayContaining([
      { Name: 'TM_AUS_DRIVER_AMAZON_S3_REGION', Value: 'ca-central-1' },
      { Name: 'TM_AUS_DRIVER_AMAZON_S3_PUBLIC_BASE_URL', Value: 'cdn.example.com' },
    ]));
    expect(JSON.stringify(template.toJSON())).not.toContain('TM_S3ASSETS');
    // With the service user, the task role gets no bucket grant.
    expect(JSON.stringify(template.toJSON())).not.toContain('s3:PutObject');
  });

  test('aus_driver_amazon_s3 without the S3 service user grants the task role the content bucket and passes no keys', () => {
    const stage = synthStage({
      ...greenfield,
      fal: { storage: FalStorage.S3, s3Driver: FalS3Driver.AUS_DRIVER_AMAZON_S3 },
      serviceIamUsers: [ServiceIamUser.CLOUDFRONT],
    });
    const template = Template.fromStack(stage.ecsStack);
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toContain('TM_AUS_DRIVER_AMAZON_S3_KEY');
    expect(json).toContain('TM_AUS_DRIVER_AMAZON_S3_BUCKET');
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([Match.objectLike({
          Action: Match.arrayWith(['s3:GetObject*', 's3:DeleteObject*', 's3:PutObject']),
          Resource: Match.arrayWith([Match.objectLike({ 'Fn::Join': Match.anyValue() })]),
        })]),
      }),
      Roles: [{ Ref: Match.stringLikeRegexp('TaskDef.*TaskRole') }],
    });
  });

  test('tm_s3assets stays the default', () => {
    const json = JSON.stringify(Template.fromStack(synthStage(greenfield).ecsStack).toJSON());
    expect(json).toContain('TM_S3ASSETS_BUCKET_NAME');
    expect(json).not.toContain('TM_AUS_DRIVER');
  });
});

describe('TmWebappAppStage, FAL bucket on the www distribution (cloudfront.falPath)', () => {
  const falSettings: EnvironmentParameters = {
    ...greenfield,
    fal: { storage: FalStorage.S3, s3Driver: FalS3Driver.AUS_DRIVER_AMAZON_S3 },
    serviceIamUsers: [ServiceIamUser.CLOUDFRONT],
    cloudfront: { domains: ['www.example.com'], falPath: '/fileadmin' },
    cdn: undefined,
  };

  /** Runs the code of a CloudFront function of the stack, found by its comment. */
  function cloudfrontFunction(template: Template, comment: string): (event: any) => any {
    const fn = Object.values(template.findResources('AWS::CloudFront::Function'))
      .find(r => r.Properties.FunctionConfig.Comment.startsWith(comment));
    const code = fn!.Properties.FunctionCode;
    expect(typeof code).toBe('string');
    return new Function(`${code}; return handler;`)();
  }

  test('serves the content bucket under /fileadmin/* of the www distribution, and creates no CDN', () => {
    const stage = synthStage(falSettings);
    expect(stage.cdnStack).toBeUndefined();
    const template = Template.fromStack(stage.cloudfrontStack!);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([Match.objectLike({
          PathPattern: '/fileadmin/*',
          AllowedMethods: ['GET', 'HEAD'],
          FunctionAssociations: [
            Match.objectLike({ EventType: 'viewer-request' }),
          ],
        })]),
      }),
    });
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  });

  test('removes the path before the bucket and adds the strict CSP and nosniff with a policy', () => {
    const template = Template.fromStack(synthStage(falSettings).cloudfrontStack!);
    const request = cloudfrontFunction(template, 'Removes /fileadmin');
    expect(request({ request: { uri: '/fileadmin/user_upload/a b.jpg', headers: {} } }).uri).toBe('/user_upload/a b.jpg');

    template.resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 1);
    const [policyId, policy] = Object.entries(template.findResources('AWS::CloudFront::ResponseHeadersPolicy'))[0];
    expect(policy.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig).toEqual({
      ContentSecurityPolicy: {
        ContentSecurityPolicy: "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; "
          + "frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox",
        Override: true,
      },
      ContentTypeOptions: { Override: true },
    });
    const config = Object.values(template.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig;
    expect(config.DefaultCacheBehavior.ResponseHeadersPolicyId).toBeUndefined();
    expect(config.CacheBehaviors.find((b: any) => b.PathPattern === '/fileadmin/*').ResponseHeadersPolicyId)
      .toEqual({ Ref: policyId });
  });

  test('falContentSecurityPolicy replaces the policy', () => {
    const template = Template.fromStack(synthStage({
      ...falSettings,
      cloudfront: { ...falSettings.cloudfront!, falContentSecurityPolicy: "default-src 'none'" },
    }).cloudfrontStack!);
    template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: { ContentSecurityPolicy: "default-src 'none'", Override: true },
        }),
      }),
    });
  });

  test('with basic auth, the FAL request function checks the credentials too', () => {
    const template = Template.fromStack(synthStage({
      ...falSettings,
      cloudfront: { ...falSettings.cloudfront!, basicAuth: true },
    }).cloudfrontStack!);
    const fn = Object.values(template.findResources('AWS::CloudFront::Function'))
      .find(r => r.Properties.FunctionConfig.Comment.startsWith('Removes /fileadmin'));
    expect(JSON.stringify(fn!.Properties.FunctionCode)).toContain('www-authenticate');
  });

  test('passes <domain>/fileadmin as the public base URL, and the www stack writes the distribution IDs', () => {
    const stage = synthStage(falSettings);
    const taskDefinition = Object.values(Template.fromStack(stage.ecsStack).findResources('AWS::ECS::TaskDefinition'))[0];
    expect(taskDefinition.Properties.ContainerDefinitions[1].Environment).toEqual(expect.arrayContaining([
      { Name: 'TM_AUS_DRIVER_AMAZON_S3_PUBLIC_BASE_URL', Value: 'www.example.com/fileadmin' },
    ]));
    const parameters = Object.values(Template.fromStack(stage.cloudfrontStack!).findResources('AWS::SSM::Parameter'))
      .map(r => r.Properties.Name);
    expect(parameters).toContain(TmParameterNames.cloudfrontDistributionIds('prod'));
  });

  test('rejects falPath with a CDN, without S3 FAL, or with a malformed path', () => {
    expect(() => synthStage({ ...falSettings, cdn: { domain: 'cdn.example.com' } })).toThrow(/choose one/);
    expect(() => synthStage({ ...falSettings, fal: { storage: FalStorage.EFS } })).toThrow(/falPath/);
    for (const falPath of ['fileadmin', '/fileadmin/', '/']) {
      expect(() => synthStage({ ...falSettings, cloudfront: { domains: ['www.example.com'], falPath } })).toThrow(/falPath/);
    }
  });
});

describe('TmWebappAppStage, response headers (cloudfront.responseHeaders opt-in)', () => {
  const headersSettings: EnvironmentParameters = {
    ...greenfield,
    fal: { storage: FalStorage.S3, s3Driver: FalS3Driver.AUS_DRIVER_AMAZON_S3 },
    cloudfront: {
      domains: ['www.example.com'],
      additionalDomains: { 'www.example.com': ['example.com'] },
      falPath: '/fileadmin',
      responseHeaders: { additionalCorsOrigins: ['https://other.example.org'] },
    },
    cdn: undefined,
  };
  const policies = (template: Template) => Object.entries(template.findResources('AWS::CloudFront::ResponseHeadersPolicy'));
  const sitePolicy = (template: Template) => policies(template)
    .find(([, p]) => p.Properties.ResponseHeadersPolicyConfig.Comment.startsWith('CORS'))![1]
    .Properties.ResponseHeadersPolicyConfig;

  test('allows CORS from the distribution domains and the additional origins, with HSTS and no CSP', () => {
    const template = Template.fromStack(synthStage(headersSettings).cloudfrontStack!);
    template.resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 2);
    const config = sitePolicy(template);
    expect(config.CorsConfig.AccessControlAllowOrigins.Items)
      .toEqual(['https://www.example.com', 'https://example.com', 'https://other.example.org']);
    expect(config.CorsConfig.AccessControlAllowCredentials).toBe(false);
    expect(config.CorsConfig.OriginOverride).toBe(false);
    expect(config.SecurityHeadersConfig.StrictTransportSecurity).toEqual({
      AccessControlMaxAgeSec: 31536000, IncludeSubdomains: true, Preload: true, Override: true,
    });
    expect(config.SecurityHeadersConfig.ContentSecurityPolicy).toBeUndefined();
    expect(config.SecurityHeadersConfig.FrameOptions.FrameOption).toBe('SAMEORIGIN');
    expect(config.SecurityHeadersConfig.ReferrerPolicy.ReferrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(config.CustomHeadersConfig.Items[0]).toEqual({
      Header: 'Permissions-Policy',
      Value: 'accelerometer=(), camera=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), geolocation=()',
      Override: true,
    });
    expect(config.RemoveHeadersConfig.Items).toEqual([{ Header: 'Server' }, { Header: 'X-Powered-By' }]);
  });

  test('permissionsPolicy replaces the default Permissions-Policy', () => {
    const template = Template.fromStack(synthStage({
      ...headersSettings,
      cloudfront: { ...headersSettings.cloudfront!, responseHeaders: { permissionsPolicy: 'camera=(self)' } },
    }).cloudfrontStack!);
    const config = sitePolicy(template);
    expect(config.CustomHeadersConfig.Items[0].Value).toBe('camera=(self)');
  });

  test('security headers settings replace the defaults', () => {
    const template = Template.fromStack(synthStage({
      ...headersSettings,
      cloudfront: {
        ...headersSettings.cloudfront!,
        responseHeaders: {
          strictTransportSecurity: { maxAge: cdk.Duration.days(30), includeSubdomains: false, preload: false },
          contentTypeOptions: false,
          frameOption: HeadersFrameOption.DENY,
          referrerPolicy: HeadersReferrerPolicy.NO_REFERRER,
          removeHeaders: ['Server'],
        },
      },
    }).cloudfrontStack!);
    const config = sitePolicy(template);
    expect(config.SecurityHeadersConfig.StrictTransportSecurity).toEqual({
      AccessControlMaxAgeSec: 2592000, IncludeSubdomains: false, Preload: false, Override: true,
    });
    expect(config.SecurityHeadersConfig.ContentTypeOptions).toBeUndefined();
    expect(config.SecurityHeadersConfig.FrameOptions.FrameOption).toBe('DENY');
    expect(config.SecurityHeadersConfig.ReferrerPolicy.ReferrerPolicy).toBe('no-referrer');
    expect(config.RemoveHeadersConfig.Items).toEqual([{ Header: 'Server' }]);
  });

  test('applies the policy to every behavior, and to FAL its copy with the CSP', () => {
    const template = Template.fromStack(synthStage(headersSettings).cloudfrontStack!);
    const [siteId] = policies(template).find(([, p]) => p.Properties.ResponseHeadersPolicyConfig.Comment.startsWith('CORS'))!;
    const [falId, fal] = policies(template).find(([, p]) => p.Properties.ResponseHeadersPolicyConfig.Comment.startsWith('FAL'))!;
    const config = Object.values(template.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig;
    const behaviors = [config.DefaultCacheBehavior, ...config.CacheBehaviors];
    expect(behaviors.map((b: any) => [b.PathPattern, b.ResponseHeadersPolicyId])).toEqual([
      [undefined, { Ref: siteId }],
      ['/typo3/*', { Ref: siteId }],
      ['/fileadmin/*', { Ref: falId }],
    ]);
    const site = sitePolicy(template);
    const falConfig = fal.Properties.ResponseHeadersPolicyConfig;
    expect(falConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy).toContain('sandbox');
    const { ContentSecurityPolicy, ...falSecurityHeaders } = falConfig.SecurityHeadersConfig;
    expect(falSecurityHeaders).toEqual(site.SecurityHeadersConfig);
    expect(falConfig.CorsConfig).toEqual(site.CorsConfig);
    expect(falConfig.CustomHeadersConfig).toEqual(site.CustomHeadersConfig);
    expect(falConfig.RemoveHeadersConfig).toEqual(site.RemoveHeadersConfig);
  });

  test('the FAL policy keeps nosniff when contentTypeOptions is false', () => {
    const template = Template.fromStack(synthStage({
      ...headersSettings,
      cloudfront: { ...headersSettings.cloudfront!, responseHeaders: { contentTypeOptions: false } },
    }).cloudfrontStack!);
    const [, fal] = policies(template).find(([, p]) => p.Properties.ResponseHeadersPolicyConfig.Comment.startsWith('FAL'))!;
    expect(fal.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentTypeOptions).toEqual({ Override: true });
    expect(sitePolicy(template).SecurityHeadersConfig.ContentTypeOptions).toBeUndefined();
  });

  test('default (no responseHeaders) creates no policy', () => {
    Template.fromStack(synthStage(greenfield).cloudfrontStack!).resourceCountIs('AWS::CloudFront::ResponseHeadersPolicy', 0);
  });
});

describe('TmWebappAppStage, Redis engine', () => {
  test('valkey creates a parameter group of the matching family', () => {
    const stage = synthStage({ ...greenfield, redis: { cacheNodeType: 'cache.t4g.micro', engine: 'valkey', engineVersion: '9.1' } });
    const template = Template.fromStack(stage.redisStack);
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      Engine: 'valkey',
      EngineVersion: '9.1',
      CacheNodeType: 'cache.t4g.micro',
      CacheParameterGroupName: { Ref: Match.stringLikeRegexp('ValkeyParameterGroup') },
    });
    template.hasResourceProperties('AWS::ElastiCache::ParameterGroup', { CacheParameterGroupFamily: 'valkey9' });
  });

  test('default stays Redis OSS 7.1', () => {
    Template.fromStack(synthStage(greenfield).redisStack).hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      Engine: 'redis',
      EngineVersion: '7.1',
    });
  });
});

describe('TmSolrStack, configuration by Ansible', () => {
  test('an SSM association runs solr-ec2-deploy.yml on the instance tagged solrinstance', () => {
    const stage = synthStage({ ...greenfield, solr: {} });
    const template = Template.fromStack(stage.solrStack!);
    template.resourceCountIs('AWS::SSM::Association', 1);
    const association = Object.values(template.findResources('AWS::SSM::Association'))[0].Properties;
    expect(association.Name).toBe('AWS-ApplyAnsiblePlaybooks');
    expect(association.Targets).toEqual([{ Key: 'tag:solrinstance', Values: ['true'] }]);
    expect(association.Parameters.PlaybookFile).toEqual(['solr-ec2-deploy.yml']);
    expect(association.Parameters.SourceInfo[0]).toContain('{{ssm-secure:/ansible/tm/github/token}}');
    // Runs again when the image changes.
    const hash = stage.solrStack!.instance.dockerImageAsset.assetHash;
    expect(association.AssociationName).toBe(`Deployment-Solr-prod-${hash.slice(0, 12)}`);
    template.hasResourceProperties('AWS::EC2::Instance', { Tags: Match.arrayWith([{ Key: 'solrinstance', Value: 'true' }]) });
  });
});

describe('TmSolrStack, instance role', () => {
  const stage = synthStage({ ...greenfield, solr: {} });
  const template = Template.fromStack(stage.solrStack!);

  test('is managed by SSM and can attach only its own tagged data volume, no AmazonEC2FullAccess', () => {
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toContain('AmazonEC2FullAccess');
    expect(json).toContain('AmazonSSMManagedInstanceCore');
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'DescribeVolumesAndInstances',
            Action: Match.arrayWith(['ec2:DescribeInstances', 'ec2:DescribeVolumes']),
            Resource: '*',
          }),
          Match.objectLike({
            Sid: 'AttachOwnDataVolume',
            Action: ['ec2:AttachVolume', 'ec2:DetachVolume'],
            Condition: { StringEquals: { 'ec2:ResourceTag/solrdata': 'true' } },
          }),
          Match.objectLike({
            Sid: 'AttachToSelf',
            Condition: { StringEquals: { 'ec2:ResourceTag/solrinstance': 'true' } },
          }),
        ]),
      }),
    });
    // The data volume and the instance carry the tags the conditions match.
    template.hasResourceProperties('AWS::EC2::Volume', { Tags: Match.arrayWith([{ Key: 'solrdata', Value: 'true' }]) });
    template.hasResourceProperties('AWS::EC2::Instance', { Tags: Match.arrayWith([{ Key: 'solrinstance', Value: 'true' }]) });
  });

  test('reads the Ansible SSM parameters under the right ARN (single slash)', () => {
    const json = JSON.stringify(template.toJSON());
    expect(json).toContain(':parameter/Solr/env-construct');
    expect(json).not.toContain(':parameter//Solr');
    expect(json).toContain(':parameter/Ansible/prefix/ssm');
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
    // By default the synth installs the CDK CLI globally, as before.
    expect(json).toMatch(/npm install -g aws-cdk\\"/);
    expect(json).toContain('cdk synth --no-lookups');
    expect(json).not.toContain('npx cdk synth');
  });

  test('useRepositoryCdkCli synthesizes with the repository CDK CLI (npx)', () => {
    const app = new cdk.App({ context: context() });
    const pipeline = new TmPipelineStack(app, 'TmPipelineStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      parameters: { ...greenfield, pipeline: { useRepositoryCdkCli: true } },
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    });
    const json = JSON.stringify(Template.fromStack(pipeline).toJSON());
    expect(json).toContain('npx cdk synth --no-lookups');
    expect(json).not.toMatch(/npm install -g aws-cdk\\"/);
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

  test('S3 source with org/repo IDs trusts both the name and immutable-ID subjects', () => {
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
          githubOrgId: '31484438',
          infrastructureGithubRepoId: '1400546627',
          applicationGithubRepoId: '1192814898',
        },
      },
      applicationDirectory: path.relative(process.cwd(), buildContextPath),
    });
    const template = Template.fromStack(pipeline);
    const role = Object.values(template.findResources('AWS::IAM::Role')).find(r =>
      JSON.stringify(r).includes('token.actions.githubusercontent.com:sub'))!;
    const subs = role.Properties.AssumeRolePolicyDocument.Statement
      .flatMap((s: any) => s.Condition?.StringLike?.['token.actions.githubusercontent.com:sub'] ?? []);
    // Both forms are trusted per repo, because the immutable-ID setting is
    // per-repository: a repo may mint either form, and this must keep working
    // if the setting is toggled on one repo and not the other.
    expect(subs).toEqual([
      'repo:toumoro/example-infra:environment:prod',
      'repo:toumoro@31484438/example-infra@1400546627:environment:prod',
      'repo:toumoro/example-app:environment:prod',
      'repo:toumoro@31484438/example-app@1192814898:environment:prod',
    ]);
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

describe('TmWebappAppStage, backups', () => {
  test('defaults to the daily EBS and RDS plans, and EFS automatic backups', () => {
    const stage = synthStage(greenfield);
    const backup = Template.fromStack(stage.backupStack);
    backup.resourceCountIs('AWS::Backup::BackupPlan', 2);
    backup.hasResourceProperties('AWS::Backup::BackupPlan', {
      BackupPlan: Match.objectLike({ BackupPlanName: 'EC2BackupPlan', BackupPlanRule: [Match.objectLike({ Lifecycle: { DeleteAfterDays: 7 } })] }),
    });
    backup.hasResourceProperties('AWS::Backup::BackupPlan', {
      BackupPlan: Match.objectLike({ BackupPlanName: 'RDSBackupPlan', BackupPlanRule: [Match.objectLike({ Lifecycle: { DeleteAfterDays: 35 } })] }),
    });
    expect(Object.keys(backup.findResources('AWS::Backup::BackupPlan'))).toEqual(expect.arrayContaining([
      expect.stringMatching(/^EC2BackupPlan/), expect.stringMatching(/^RDSBackupPlan/),
    ]));
    backup.hasResourceProperties('AWS::IAM::Role', { ManagedPolicyArns: Match.arrayEquals([Match.anyValue()]) });
    Template.fromStack(stage.ecsStack).hasResourceProperties('AWS::EFS::FileSystem', { BackupPolicy: { Status: 'ENABLED' } });
    expect(JSON.stringify(Template.fromStack(stage.ecsStack).toJSON())).not.toContain('tm:backup');
  });

  test('with rules, one plan for the selected resources, the EFS and the content bucket tagged', () => {
    const stage = synthStage({
      ...greenfield,
      backup: {
        rules: [
          { ruleName: 'Daily', retentionDays: 30, scheduleExpression: events.Schedule.cron({ minute: '0', hour: '6' }) },
          { ruleName: 'Monthly', retentionDays: 365, scheduleExpression: events.Schedule.cron({ minute: '0', hour: '6', day: '1' }) },
        ],
        resources: [BackupResourceType.EC2_INSTANCES, BackupResourceType.RDS_CLUSTERS, BackupResourceType.EFS, BackupResourceType.S3_CONTENT_BUCKET],
        efsAutomaticBackups: false,
      },
    });
    const backup = Template.fromStack(stage.backupStack);
    backup.resourceCountIs('AWS::Backup::BackupPlan', 1);
    backup.resourceCountIs('AWS::Backup::BackupVault', 1);
    backup.hasResourceProperties('AWS::Backup::BackupPlan', {
      BackupPlan: Match.objectLike({
        BackupPlanRule: [
          Match.objectLike({ RuleName: 'Daily', ScheduleExpression: 'cron(0 6 * * ? *)', Lifecycle: { DeleteAfterDays: 30 } }),
          Match.objectLike({ RuleName: 'Monthly', ScheduleExpression: 'cron(0 6 1 * ? *)', Lifecycle: { DeleteAfterDays: 365 } }),
        ],
      }),
    });
    backup.hasResourceProperties('AWS::Backup::BackupSelection', {
      BackupSelection: Match.objectLike({
        Resources: [`arn:aws:ec2:ca-central-1:${ACCOUNT}:instance/*`, `arn:aws:rds:ca-central-1:${ACCOUNT}:cluster:*`],
      }),
    });
    backup.hasResourceProperties('AWS::Backup::BackupSelection', {
      BackupSelection: Match.objectLike({
        ListOfTags: [{ ConditionKey: 'tm:backup', ConditionType: 'STRINGEQUALS', ConditionValue: 'true' }],
      }),
    });
    const tag = { Key: 'tm:backup', Value: 'true' };
    Template.fromStack(stage.ecsStack).hasResourceProperties('AWS::EFS::FileSystem', {
      BackupPolicy: { Status: 'DISABLED' },
      FileSystemTags: Match.arrayWith([tag]),
    });
    Template.fromStack(stage.s3Stack!).hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: { Status: 'Enabled' },
      Tags: Match.arrayWith([tag]),
    });
  });

  test('rejects S3_CONTENT_BUCKET without a content bucket', () => {
    expect(() => synthStage({
      ...greenfield,
      fal: { storage: FalStorage.EFS },
      serviceIamUsers: [],
      cdn: undefined,
      backup: { rules: [{ ruleName: 'Daily', retentionDays: 30 }], resources: [BackupResourceType.S3_CONTENT_BUCKET] },
    })).toThrow(/S3_CONTENT_BUCKET/);
  });
});
