import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DistributionIdsFormat } from '../../config/enums';
import { publishParameter } from '../common/references';

/**
 * A distribution and the domains it serves.
 */
export interface TmDistributionEntry {
  /**
   * Domains of the distribution, the main one first.
   */
  readonly domains: string[];

  /**
   * Distribution ID.
   */
  readonly distributionId: string;
}

/**
 * Where and how the distribution IDs are published for tm_cloudfront and the
 * pipeline invalidation step.
 */
export interface TmDistributionIdsOptions {
  /**
   * Name of the SSM parameter.
   */
  readonly parameterName: string;

  /**
   * Value format, which follows the project's tm_cloudfront version.
   */
  readonly format: DistributionIdsFormat;
}

/**
 * Writes the distribution-ID parameter: a plain ID, a JSON list of IDs, or a
 * JSON object mapping every domain to its distribution ID.
 */
export class TmDistributionIdsParameter extends Construct {
  constructor(scope: Construct, id: string, options: TmDistributionIdsOptions, entries: TmDistributionEntry[]) {
    super(scope, id);

    const stack = cdk.Stack.of(this);
    let value: string;
    switch (options.format) {
      case DistributionIdsFormat.PLAIN:
        value = entries[0].distributionId;
        break;
      case DistributionIdsFormat.JSON_LIST:
        value = stack.toJsonString(entries.map(entry => entry.distributionId));
        break;
      case DistributionIdsFormat.JSON_MAP: {
        const map: { [domain: string]: string } = {};
        entries.forEach(entry => entry.domains.forEach(domain => map[domain] = entry.distributionId));
        value = stack.toJsonString(map);
        break;
      }
    }

    publishParameter(this, 'Parameter', options.parameterName, value);
  }
}
