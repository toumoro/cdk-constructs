import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  EnvironmentParameters,
  FalStorage,
  TmBootstrapAssetsStack,
  TmParameterNames,
  TmWebappAppStage,
} from '../src';

const ACCOUNT = '111111111111';
const buildContextPath = path.join(__dirname, 'fixtures', 'webapp');

/** Minimal parameter set, EFS (no distribution), close to a real consumer. */
const base: EnvironmentParameters = {
  account: ACCOUNT,
  environmentName: 'production',
  vpc: { cidr: '10.3.0.0/16', hostedZoneName: 'example-site-web.internal' },
  rds: { instanceType: 't3.medium', performanceInsights: false },
  ecs: {
    environment: {
      TM_DATABASE_NAME: 'epq_typo3_v14',
      TM_DATABASE_USERNAME: 'epq_typo3_v14',
    },
    secretsFromSecretsManager: {
      TM_TYPO3_MAIL_TRANSPORT_SMTP_PASSWORD: { secretArnParameterName: '/applications/tm/secrets-arn', field: 'TM_TYPO3_MAIL_TRANSPORT_SMTP_PASSWORD' },
    },
    generatedSecrets: ['TM_TYPO3_CONF_VARS_SYS_ENCRYPTION_KEY'],
  },
  fal: { storage: FalStorage.EFS },
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

const bootstrapEnabled: EnvironmentParameters = {
  ...base,
  rds: { ...base.rds, bootstrap: { enabled: true } },
};

describe('TmBootstrapAssetsStack', () => {
  test('a versioned, retained, private, SSL-only bucket whose name is published in SSM', () => {
    const app = new cdk.App();
    const stack = new TmBootstrapAssetsStack(app, 'TmBootstrapAssetsStack', {
      env: { account: ACCOUNT, region: 'ca-central-1' },
      environmentName: 'production',
    });
    const template = Template.fromStack(stack);
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        VersioningConfiguration: { Status: 'Enabled' },
        PublicAccessBlockConfiguration: Match.objectLike({ BlockPublicPolicy: true }),
        BucketEncryption: Match.objectLike({
          ServerSideEncryptionConfiguration: [Match.objectLike({
            ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' },
          })],
        }),
      }),
    });
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: TmParameterNames.bootstrapAssetsBucketName('production'),
    });
  });

  test('the bucket-name parameter differs per environment (no cross-env collision)', () => {
    expect(TmParameterNames.bootstrapAssetsBucketName('production'))
      .not.toBe(TmParameterNames.bootstrapAssetsBucketName('staging'));
    expect(TmParameterNames.bootstrapAssetsBucketName('production'))
      .toBe('/tm/production/bootstrap/assets-bucket/name');
  });
});

describe('RDS bootstrap, disabled (default)', () => {
  const stage = synthStage(base);

  test('the RDS stack creates no bootstrap Lambda, no custom resource, no generated password secret', () => {
    const template = Template.fromStack(stage.rdsStack);
    // No bootstrap custom resource, no application password secret, no 3306 rule
    // for the bootstrap Lambda. (The RDS stack may contain a base Lambda — so we
    // target the markers specific to bootstrap, not a global count.)
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 0);
    const json = JSON.stringify(template.toJSON());
    expect(json).not.toContain('AppDatabasePassword');
    expect(json).not.toContain('/applications/tm/generated/TM_DATABASE_PASSWORD');
    expect(json).not.toContain('Allow from RDS bootstrap Lambda');
  });

  test('ECS does not wire TM_DATABASE_PASSWORD as a generated secret when bootstrap is off', () => {
    const json = JSON.stringify(Template.fromStack(stage.ecsStack).toJSON());
    expect(json).not.toContain('generated/TM_DATABASE_PASSWORD-arn');
  });
});

describe('RDS bootstrap, enabled', () => {
  const stage = synthStage(bootstrapEnabled);

  test('the RDS stack creates the bootstrap Lambda (Python) and a custom resource', () => {
    const template = Template.fromStack(stage.rdsStack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: Match.stringLikeRegexp('python3.*'),
      Handler: 'index.handler',
      Timeout: 900,
    });
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
  });

  test('the RDS stack generates TM_DATABASE_PASSWORD and publishes its ARN (single source of truth)', () => {
    const template = Template.fromStack(stage.rdsStack);
    template.hasResource('AWS::SecretsManager::Secret', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({ Name: '/applications/tm/generated/TM_DATABASE_PASSWORD' }),
    });
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: TmParameterNames.generatedSecretArn('tm', 'TM_DATABASE_PASSWORD'),
    });
  });

  test('the bootstrap Lambda security group reaches the cluster on 3306', () => {
    const template = Template.fromStack(stage.rdsStack);
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      FromPort: 3306,
      Description: 'Allow from RDS bootstrap Lambda',
    });
  });

  test('ECS reads TM_DATABASE_PASSWORD from the same generated ARN parameter, whole-secret (no field)', () => {
    const template = Template.fromStack(stage.ecsStack);
    const taskDefinition = Object.values(template.findResources('AWS::ECS::TaskDefinition'))[0];
    const fpm = taskDefinition.Properties.ContainerDefinitions[1];
    const secret = fpm.Secrets.find((s: { Name: string }) => s.Name === 'TM_DATABASE_PASSWORD');
    expect(secret).toBeDefined();
    // Whole secret (no JSON field suffix ":field::"): raw ARN.
    const valueFrom = JSON.stringify(secret.ValueFrom);
    expect(valueFrom).not.toMatch(/:[A-Za-z0-9_]+::"?\]?$/);
    // The ARN is resolved from the SSM parameter published by the RDS stack.
    expect(JSON.stringify(template.toJSON())).toContain('generated/TM_DATABASE_PASSWORD-arn');
  });

  test('rejects a consumer that also keeps TM_DATABASE_PASSWORD in the human secret block', () => {
    expect(() => synthStage({
      ...bootstrapEnabled,
      ecs: {
        ...bootstrapEnabled.ecs,
        secretsFromSecretsManager: {
          ...bootstrapEnabled.ecs.secretsFromSecretsManager,
          TM_DATABASE_PASSWORD: { secretArnParameterName: '/applications/tm/secrets-arn', field: 'TM_DATABASE_PASSWORD' },
        },
      },
    })).toThrow(/TM_DATABASE_PASSWORD/);
  });

  test('fails fast when TM_DATABASE_NAME or TM_DATABASE_USERNAME is missing', () => {
    expect(() => synthStage({
      ...bootstrapEnabled,
      ecs: { ...bootstrapEnabled.ecs, environment: {} },
    })).toThrow(/TM_DATABASE_NAME/);
  });
});
