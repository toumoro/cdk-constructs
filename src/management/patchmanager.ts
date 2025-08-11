import {
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export interface IPatchManagerProps {
  tagPatchGroup?: string;
  cronScheduleUpdates?: string;
  cronScheduleFullUpdates?: string;
  operatingSystem?: string;
  commandUpdate?: string;
}

export class TmPatchManager extends Construct {

  constructor(scope: Construct, id: string, props: IPatchManagerProps) {
    super(scope, id);

    const {
      tagPatchGroup = 'tmPatchGroup', // Patch Group tag (must match the one in your baseline)
      cronScheduleUpdates = 'cron(* */2 * * ? *)', // Every 2 hours
      cronScheduleFullUpdates = 'cron(* 2 ? * 3 *)', // Weekly on tuesday at 2 AM
      operatingSystem = 'AMAZON_LINUX_2023', // Operating system for the patch baseline
      commandUpdate = 'sudo dnf upgrade -y "*"', // Command to run for full updates
    } = props;

    new ssm.CfnPatchBaseline(this, 'TmPatchBaseLine', {
      name: 'TmPathchBaseline',
      operatingSystem: operatingSystem,
      description: `Patch baseline for ${operatingSystem} instances in the Tm environment`,
      patchGroups: [tagPatchGroup],
      defaultBaseline: false, // Set to false to avoid conflicts with default baselines

      approvalRules: {
        patchRules: [{
          approveAfterDays: 0,
          enableNonSecurity: true,
          patchFilterGroup: {
            patchFilters: [{
              key: 'CLASSIFICATION',
              values: ['*'],
            }],
          },
        }],
      },
    });

    const maintenanceWindowUpdates = new ssm.CfnMaintenanceWindow(this, 'TmPatchMaintenaceWindows', {
      name: 'TmMaintenanceWindowUpdates',
      schedule: cronScheduleUpdates,
      duration: 2,
      cutoff: 1,
      allowUnassociatedTargets: false,
    });

    const maintenanceWindowFullUpdates = new ssm.CfnMaintenanceWindow(this, 'TmPatchMaintenaceWindowsFull', {
      name: 'TmMaintenanceWindowFullUpdates',
      schedule: cronScheduleFullUpdates,
      duration: 2,
      cutoff: 1,
      allowUnassociatedTargets: false,
    });

    const target = new ssm.CfnMaintenanceWindowTarget(this, 'TmPatchTarget', {
      resourceType: 'INSTANCE',
      targets: [{
        key: 'tag:PatchGroup',
        values: [tagPatchGroup],
      }],
      windowId: maintenanceWindowUpdates.ref,
    });

    const targetFull = new ssm.CfnMaintenanceWindowTarget(this, 'TmPatchTargetFull', {
      resourceType: 'INSTANCE',
      targets: [{
        key: 'tag:PatchGroup',
        values: [tagPatchGroup],
      }],
      windowId: maintenanceWindowFullUpdates.ref,
    });

    new ssm.CfnMaintenanceWindowTask(this, 'TmPatchTask', {
      priority: 1,
      windowId: maintenanceWindowUpdates.ref,
      taskArn: 'AWS-RunPatchBaseline',
      taskType: 'RUN_COMMAND',
      targets: [
        {
          key: 'WindowTargetIds',
          values: [target.ref],
        },
      ],
      maxConcurrency: '50',
      maxErrors: '50',
      taskInvocationParameters: {
        maintenanceWindowRunCommandParameters: {
          parameters: {
            Operation: ['Install'],
          },
        },
      },
    });

    new ssm.CfnMaintenanceWindowTask(this, 'TmPatchTaskFull', {
      priority: 2,
      windowId: maintenanceWindowFullUpdates.ref,
      taskArn: 'AWS-RunShellScript',
      taskType: 'RUN_COMMAND',
      targets: [
        {
          key: 'WindowTargetIds',
          values: [targetFull.ref],
        },
      ],
      maxConcurrency: '50',
      maxErrors: '50',
      taskInvocationParameters: {
        maintenanceWindowRunCommandParameters: {
          parameters: {
            commands: [commandUpdate],
          },
        },
      },
    });

  }

}