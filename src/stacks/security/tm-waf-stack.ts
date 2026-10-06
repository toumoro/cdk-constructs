import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { CfnLoggingConfiguration, CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { TmParameterNames } from '../../config/parameter-names';

/**
 * Props for `TmWafStack`.
 */
export interface TmWafStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * Region where the WebACL ARN is published in SSM (the application region).
   */
  readonly parameterRegion: string;

  /**
   * Maximum requests per client IP in any 5-minute window.
   *
   * @default 2000
   */
  readonly rateLimit?: number;

  /**
   * Country codes whose requests are blocked.
   *
   * @default []
   */
  readonly blockedCountryCodes?: string[];

  /**
   * Sends the WebACL logs to CloudWatch Logs (30-day retention).
   *
   * @default true
   */
  readonly logging?: boolean;
}

/**
 * Baseline CloudFront-scope WebACL, derived from pgu's: AWS IP reputation,
 * known bad inputs, a per-IP rate limit, and the common, SQL injection and PHP
 * rule sets outside the TYPO3 backend (`/typo3/`). Anonymous IPs are counted
 * only. Must be deployed in us-east-1. The ARN is published in SSM in the
 * application region.
 */
export class TmWafStack extends cdk.Stack {
  /** ARN of the WebACL. */
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: TmWafStackProps) {
    super(scope, id, props);

    const rules: CfnWebACL.RuleProperty[] = [];
    const blockedCountryCodes = props.blockedCountryCodes ?? [];

    if (blockedCountryCodes.length > 0) {
      rules.push({
        name: 'Block-countries',
        priority: 0,
        action: { block: {} },
        statement: { geoMatchStatement: { countryCodes: blockedCountryCodes } },
        visibilityConfig: visibility('Block-countries'),
      });
    }

    rules.push(
      managedRuleGroup('AWSManagedRulesAmazonIpReputationList', 10),
      managedRuleGroup('AWSManagedRulesAnonymousIpList', 20, { countOnly: true }),
      {
        name: 'Rate-limit-per-ip',
        priority: 30,
        action: { block: {} },
        statement: {
          rateBasedStatement: {
            limit: props.rateLimit ?? 2000,
            aggregateKeyType: 'IP',
            evaluationWindowSec: 300,
          },
        },
        visibilityConfig: visibility('Rate-limit-per-ip'),
      },
      managedRuleGroup('AWSManagedRulesKnownBadInputsRuleSet', 40),
      // Large request bodies are normal for file uploads.
      managedRuleGroup('AWSManagedRulesCommonRuleSet', 50, { outsideBackend: true, countedRules: ['SizeRestrictions_BODY'] }),
      managedRuleGroup('AWSManagedRulesSQLiRuleSet', 60, { outsideBackend: true }),
      managedRuleGroup('AWSManagedRulesPHPRuleSet', 70, { outsideBackend: true }),
    );

    const webAcl = new CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: visibility(`tm-${props.environmentName}-web-acl`),
      rules,
    });
    this.webAclArn = webAcl.attrArn;

    if (props.logging ?? true) {
      const logGroup = new logs.LogGroup(this, 'LogGroup', {
        // WAF only logs to groups whose name starts with aws-waf-logs-.
        logGroupName: `aws-waf-logs-tm-${props.environmentName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      const loggingConfiguration = new CfnLoggingConfiguration(this, 'LoggingConfiguration', {
        resourceArn: webAcl.attrArn,
        logDestinationConfigs: [this.formatArn({
          service: 'logs',
          resource: 'log-group',
          resourceName: logGroup.logGroupName,
          arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
        })],
      });
      // The destination is a formatted ARN, not a reference: order it explicitly.
      loggingConfiguration.node.addDependency(logGroup);
    }

    // SSM parameters are regional: write the ARN where the distributions read it.
    const parameterName = TmParameterNames.wafWebAclArn(props.environmentName);
    const putParameter: cr.AwsSdkCall = {
      service: '@aws-sdk/client-ssm',
      action: 'PutParameterCommand',
      parameters: { Name: parameterName, Value: webAcl.attrArn, Type: 'String', Overwrite: true },
      region: props.parameterRegion,
      physicalResourceId: cr.PhysicalResourceId.of(parameterName),
    };
    new cr.AwsCustomResource(this, 'WebAclArnParameter', {
      onCreate: putParameter,
      onUpdate: putParameter,
      onDelete: {
        service: '@aws-sdk/client-ssm',
        action: 'DeleteParameterCommand',
        parameters: { Name: parameterName },
        region: props.parameterRegion,
        ignoreErrorCodesMatching: 'ParameterNotFound',
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
          resources: [`arn:${this.partition}:ssm:${props.parameterRegion}:${this.account}:parameter${parameterName}`],
        }),
      ]),
      installLatestAwsSdk: false,
    });

    new cdk.CfnOutput(this, 'WebAclArn', { value: webAcl.attrArn });
  }
}

function visibility(metricName: string): CfnWebACL.VisibilityConfigProperty {
  return { cloudWatchMetricsEnabled: true, sampledRequestsEnabled: true, metricName };
}

interface ManagedRuleGroupOptions {
  /** Counts the group's matches instead of applying its actions. */
  readonly countOnly?: boolean;
  /** Doesn't evaluate the group on the TYPO3 backend. */
  readonly outsideBackend?: boolean;
  /** Rules of the group that only count. */
  readonly countedRules?: string[];
}

function managedRuleGroup(name: string, priority: number, options: ManagedRuleGroupOptions = {}): CfnWebACL.RuleProperty {
  const outsideBackend: CfnWebACL.StatementProperty = {
    notStatement: {
      statement: {
        byteMatchStatement: {
          searchString: '/typo3/',
          fieldToMatch: { uriPath: {} },
          textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
          positionalConstraint: 'STARTS_WITH',
        },
      },
    },
  };
  return {
    name: `AWS-${name}`,
    priority,
    overrideAction: options.countOnly ? { count: {} } : { none: {} },
    statement: {
      managedRuleGroupStatement: {
        vendorName: 'AWS',
        name,
        scopeDownStatement: options.outsideBackend ? outsideBackend : undefined,
        ruleActionOverrides: options.countedRules?.map(rule => ({ name: rule, actionToUse: { count: {} } })),
      },
    },
    visibilityConfig: visibility(`AWS-${name}`),
  };
}
