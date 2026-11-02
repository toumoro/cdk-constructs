import * as cdk from 'aws-cdk-lib';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct, IConstruct } from 'constructs';

/**
 * A rule of the backup plan: when to back up, and how long to keep it.
 */
export interface TmBackupRule {
  /**
   * Name of the rule, unique in the plan (e.g. `Daily`, `Monthly`).
   */
  readonly ruleName: string;

  /**
   * Retention of the recovery points, in days.
   */
  readonly retentionDays: number;

  /**
   * Backup schedule.
   *
   * @default - daily at midnight UTC
   */
  readonly scheduleExpression?: events.Schedule;
}

/**
 * Props for `TmBackupStack`.
 */
export interface TmBackupStackProps extends cdk.StackProps {
  /**
   * Retention of the EBS volume backups, in days. Ignored when `rules` is set.
   *
   * @default 7
   */
  readonly ec2RetentionDays?: number;

  /**
   * Retention of the RDS cluster backups, in days. Ignored when `rules` is set.
   *
   * @default 35
   */
  readonly rdsRetentionDays?: number;

  /**
   * Backup schedule of the EBS and RDS plans. Ignored when `rules` is set.
   *
   * @default - daily at midnight UTC
   */
  readonly scheduleExpression?: events.Schedule;

  /**
   * Rules of a single plan backing up `resources`, in place of the EBS and RDS
   * plans.
   *
   * @default - the EBS and RDS plans
   */
  readonly rules?: TmBackupRule[];

  /**
   * Resources backed up by `rules`, by ARN (wildcards allowed). Resources
   * tagged with the `TmBackupStack.SELECTION_TAG_KEY` tag are backed up too.
   *
   * @default - none, only the tagged resources
   */
  readonly resources?: backup.BackupResource[];
}

/**
 * AWS Backup plans in an encrypted vault.
 *
 * By default, two daily plans for every EBS volume and RDS cluster of the
 * account. With `rules`, a single plan for `resources` and the resources
 * tagged with `SELECTION_TAG_KEY`.
 */
export class TmBackupStack extends cdk.Stack {
  /**
   * Key of the tag selecting a resource for the plan of `rules`.
   */
  public static readonly SELECTION_TAG_KEY = 'tm:backup';

  /**
   * Value of the tag selecting a resource for the plan of `rules`.
   */
  public static readonly SELECTION_TAG_VALUE = 'true';

  /**
   * Tags `resource` so the plan of `rules` backs it up.
   */
  public static select(resource: IConstruct): void {
    cdk.Tags.of(resource).add(TmBackupStack.SELECTION_TAG_KEY, TmBackupStack.SELECTION_TAG_VALUE);
  }

  constructor(scope: Construct, id: string, props: TmBackupStackProps = {}) {
    super(scope, id, props);

    const scheduleExpression = props.scheduleExpression ?? events.Schedule.cron({ minute: '0', hour: '0' });

    const backupKey = new kms.Key(this, 'BackupKey', {
      enableKeyRotation: true,
    });

    const backupVault = new backup.BackupVault(this, 'BackupVault', {
      encryptionKey: backupKey,
    });

    const backupRole = new iam.Role(this, 'BackupRole', {
      assumedBy: new iam.ServicePrincipal('backup.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup'),
      ],
    });

    if (props.rules) {
      this.addRulesPlan(props.rules, props.resources ?? [], backupVault, backupRole);
      return;
    }

    const ec2BackupPlan = new backup.BackupPlan(this, 'EC2BackupPlan', {
      backupPlanRules: [
        new backup.BackupPlanRule({
          scheduleExpression,
          deleteAfter: cdk.Duration.days(props.ec2RetentionDays ?? 7),
          backupVault,
        }),
      ],
    });

    ec2BackupPlan.addSelection('EC2BackupSelection', {
      resources: [
        backup.BackupResource.fromArn(`arn:aws:ec2:${this.region}:${this.account}:volume/*`),
      ],
      role: backupRole,
    });

    const rdsBackupPlan = new backup.BackupPlan(this, 'RDSBackupPlan', {
      backupPlanRules: [
        new backup.BackupPlanRule({
          scheduleExpression,
          deleteAfter: cdk.Duration.days(props.rdsRetentionDays ?? 35),
          backupVault,
        }),
      ],
    });

    rdsBackupPlan.addSelection('RDSBackupSelection', {
      resources: [
        backup.BackupResource.fromArn('arn:aws:rds:*:*:cluster:*'),
      ],
      role: backupRole,
    });
  }

  private addRulesPlan(rules: TmBackupRule[], resources: backup.BackupResource[], backupVault: backup.IBackupVault, backupRole: iam.Role) {
    if (rules.length === 0) {
      throw new Error('backup.rules must contain at least one rule.');
    }
    // Restores and S3 buckets (versioned) need their own managed policies.
    ['service-role/AWSBackupServiceRolePolicyForRestores', 'AWSBackupServiceRolePolicyForS3Backup', 'AWSBackupServiceRolePolicyForS3Restore']
      .forEach(name => backupRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(name)));

    // When rules fire in the same window (e.g. daily and monthly on the 1st),
    // AWS Backup only keeps the job with the longest retention.
    const plan = new backup.BackupPlan(this, 'BackupPlan', {
      backupVault,
      backupPlanRules: rules.map(rule => new backup.BackupPlanRule({
        ruleName: rule.ruleName,
        scheduleExpression: rule.scheduleExpression ?? events.Schedule.cron({ minute: '0', hour: '0' }),
        deleteAfter: cdk.Duration.days(rule.retentionDays),
      })),
    });

    // Separate selections, so the ARNs and the tag each select on their own.
    if (resources.length > 0) {
      plan.addSelection('ResourcesSelection', { resources, role: backupRole });
    }
    plan.addSelection('TaggedSelection', {
      resources: [backup.BackupResource.fromTag(TmBackupStack.SELECTION_TAG_KEY, TmBackupStack.SELECTION_TAG_VALUE)],
      role: backupRole,
    });
  }
}
