import * as cdk from 'aws-cdk-lib';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

/**
 * Props for `TmBackupStack`.
 */
export interface TmBackupStackProps extends cdk.StackProps {
  /**
   * Retention of the EBS volume backups, in days.
   *
   * @default 7
   */
  readonly ec2RetentionDays?: number;

  /**
   * Retention of the RDS cluster backups, in days.
   *
   * @default 35
   */
  readonly rdsRetentionDays?: number;

  /**
   * Backup schedule.
   *
   * @default - daily at midnight UTC
   */
  readonly scheduleExpression?: events.Schedule;
}

/**
 * Daily AWS Backup plans for every EBS volume and RDS cluster of the account,
 * in an encrypted vault.
 */
export class TmBackupStack extends cdk.Stack {
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
}
