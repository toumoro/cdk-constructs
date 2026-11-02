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
 * Static files and API calls: they can't answer a browser challenge.
 */
const NO_CHALLENGE_URI_REGEX = '\\/api\\/|\\.(acc|avi|css|gif|ico|jpe?g|js|json|mp[34]|ogg|otf|pdf|png|tiff?|ttf|webm|webp|woff2?|xml)$';

/**
 * Baseline CloudFront-scope WebACL, derived from pgu's: AWS anti-DDoS, IP
 * reputation, known bad inputs, a per-IP rate limit, and the common, SQL
 * injection and PHP rule sets. Anonymous IPs are counted only, but
 * hosting-provider IPs (except Site24x7 monitoring) get a challenge on pages.
 * Solr searches (`tx_solr`) are rate limited per IP, and facet filters
 * challenged.
 * The body rules of the common, SQL injection and PHP sets only count; the
 * TYPO3 rules, from sqnim's TYPO3Overrider, block their matches except where
 * TYPO3 legitimately posts such bodies. Must be deployed in us-east-1. The ARN
 * is published in SSM in the application region.
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
      // Challenges suspicious browsers and blocks the most likely DDoS requests.
      managedRuleGroup('AWSManagedRulesAntiDDoSRuleSet', 5, {
        configs: [{
          awsManagedRulesAntiDDoSRuleSet: {
            clientSideActionConfig: {
              challenge: {
                usageOfAction: 'ENABLED',
                sensitivity: 'HIGH',
                exemptUriRegularExpressions: [{ regexString: NO_CHALLENGE_URI_REGEX }],
              },
            },
            sensitivityToBlock: 'LOW',
          },
        }],
      }),
      managedRuleGroup('AWSManagedRulesAmazonIpReputationList', 10),
      // Counted only, but labels the requests for the next rule.
      managedRuleGroup('AWSManagedRulesAnonymousIpList', 20, { countOnly: true }),
      {
        name: 'Challenge-hosting-provider-not-site24x7',
        priority: 25,
        action: { challenge: {} },
        statement: {
          andStatement: {
            statements: [
              { labelMatchStatement: { scope: 'LABEL', key: 'awswaf:managed:aws:anonymous-ip-list:HostingProviderIPList' } },
              // Site24x7 uptime monitoring runs from hosting providers.
              {
                notStatement: {
                  statement: {
                    byteMatchStatement: {
                      searchString: 'Site24x7',
                      fieldToMatch: { singleHeader: { Name: 'user-agent' } },
                      textTransformations: [{ priority: 0, type: 'NONE' }],
                      positionalConstraint: 'EXACTLY',
                    },
                  },
                },
              },
              {
                notStatement: {
                  statement: {
                    regexMatchStatement: {
                      regexString: NO_CHALLENGE_URI_REGEX,
                      fieldToMatch: { uriPath: {} },
                      textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
                    },
                  },
                },
              },
            ],
          },
        },
        challengeConfig: { immunityTimeProperty: { immunityTime: 300 } },
        visibilityConfig: visibility('Challenge-hosting-provider-not-site24x7'),
      },
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
      // Solr searches: bots crawling every facet combination.
      {
        name: 'Rate-limit-solr-block',
        priority: 31,
        action: {
          block: { customResponse: { responseCode: 429, responseHeaders: [{ name: 'Retry-After', value: '60' }] } },
        },
        statement: solrRateLimit(300),
        visibilityConfig: visibility('Rate-limit-solr-block'),
      },
      {
        name: 'Rate-limit-solr-challenge',
        priority: 32,
        action: { challenge: {} },
        statement: solrRateLimit(100),
        visibilityConfig: visibility('Rate-limit-solr-challenge'),
      },
      // One client of a shared IP: same IP and TLS fingerprint.
      {
        name: 'Rate-limit-solr-ja4-challenge',
        priority: 33,
        action: { challenge: {} },
        statement: solrRateLimit(60, [{ ip: {} }, { ja4Fingerprint: { fallbackBehavior: 'NO_MATCH' } }]),
        visibilityConfig: visibility('Rate-limit-solr-ja4-challenge'),
      },
      {
        name: 'Challenge-solr-filter',
        priority: 34,
        action: { challenge: {} },
        statement: queryStringContains('tx_solr[filter]'),
        visibilityConfig: visibility('Challenge-solr-filter'),
      },
      managedRuleGroup('AWSManagedRulesKnownBadInputsRuleSet', 40),
      // Body rules: counted here, blocked by the TYPO3 rules below.
      managedRuleGroup('AWSManagedRulesCommonRuleSet', 50, {
        countedRules: ['SizeRestrictions_BODY', 'CrossSiteScripting_BODY', 'GenericLFI_BODY'],
      }),
      managedRuleGroup('AWSManagedRulesSQLiRuleSet', 60, { countedRules: ['SQLi_BODY'] }),
      managedRuleGroup('AWSManagedRulesPHPRuleSet', 70, { countedRules: ['PHPHighRiskMethodsVariables_BODY'] }),
      // Large bodies: SAML responses, Powermail forms, backend uploads.
      typo3Rule('TYPO3_SizeRestrictions_Body', 80, 'core-rule-set:SizeRestrictions_Body', [
        uriStartsWith('/simplesaml/module.php/saml/sp/saml2-acs.php/'),
        queryStringStartsWith('tx_powermail_pi1'),
        uriStartsWith('/typo3/'),
      ]),
      // Rich text and code in backend forms.
      typo3Rule('TYPO3_CrossSiteScripting_BODY', 81, 'core-rule-set:CrossSiteScripting_Body', [uriStartsWith('/typo3')]),
      typo3Rule('TYPO3_SQLi_Body', 82, 'sql-database:SQLi_Body', [uriStartsWith('/typo3/file/commit')]),
      typo3Rule('TYPO3_PHPHighRiskMethodsVariables_Body', 83, 'php-app:PHPHighRiskMethodsVariables_Body', [uriStartsWith('/typo3/record/edit')]),
      typo3Rule('TYPO3_GenericLFI_Body', 84, 'core-rule-set:GenericLFI_Body', [uriStartsWith('/typo3/index.php')]),
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
  /** Rules of the group that only count. */
  readonly countedRules?: string[];
  /** Configuration of the group. */
  readonly configs?: CfnWebACL.ManagedRuleGroupConfigProperty[];
}

function managedRuleGroup(name: string, priority: number, options: ManagedRuleGroupOptions = {}): CfnWebACL.RuleProperty {
  return {
    name: `AWS-${name}`,
    priority,
    overrideAction: options.countOnly ? { count: {} } : { none: {} },
    statement: {
      managedRuleGroupStatement: {
        vendorName: 'AWS',
        name,
        ruleActionOverrides: options.countedRules?.map(rule => ({ name: rule, actionToUse: { count: {} } })),
        managedRuleGroupConfigs: options.configs,
      },
    },
    visibilityConfig: visibility(`AWS-${name}`),
  };
}

/**
 * Blocks the requests that a counted managed rule labeled (`label`, after
 * `awswaf:managed:aws:`), except those matching one of `exceptions`.
 */
function typo3Rule(name: string, priority: number, label: string, exceptions: CfnWebACL.StatementProperty[]): CfnWebACL.RuleProperty {
  return {
    name,
    priority,
    action: { block: {} },
    statement: {
      andStatement: {
        statements: [
          { labelMatchStatement: { scope: 'LABEL', key: `awswaf:managed:aws:${label}` } },
          { notStatement: { statement: exceptions.length > 1 ? { orStatement: { statements: exceptions } } : exceptions[0] } },
        ],
      },
    },
    visibilityConfig: visibility(name),
  };
}

/**
 * More than `limit` Solr searches (`tx_solr` in the query string) per minute
 * by the same `customKeys`, or the same IP without them.
 */
function solrRateLimit(limit: number, customKeys?: CfnWebACL.RateBasedStatementCustomKeyProperty[]): CfnWebACL.StatementProperty {
  return {
    rateBasedStatement: {
      limit,
      evaluationWindowSec: 60,
      aggregateKeyType: customKeys ? 'CUSTOM_KEYS' : 'IP',
      customKeys,
      scopeDownStatement: queryStringContains('tx_solr'),
    },
  };
}

function queryStringContains(value: string): CfnWebACL.StatementProperty {
  return {
    byteMatchStatement: {
      searchString: value,
      fieldToMatch: { queryString: {} },
      textTransformations: [{ priority: 0, type: 'URL_DECODE' }, { priority: 1, type: 'LOWERCASE' }],
      positionalConstraint: 'CONTAINS',
    },
  };
}

function uriStartsWith(path: string): CfnWebACL.StatementProperty {
  return startsWith(path, { uriPath: {} });
}

function queryStringStartsWith(value: string): CfnWebACL.StatementProperty {
  return startsWith(value, { queryString: {} });
}

function startsWith(searchString: string, fieldToMatch: CfnWebACL.FieldToMatchProperty): CfnWebACL.StatementProperty {
  return {
    byteMatchStatement: {
      searchString,
      fieldToMatch,
      textTransformations: [{ priority: 0, type: 'NONE' }],
      positionalConstraint: 'STARTS_WITH',
    },
  };
}
