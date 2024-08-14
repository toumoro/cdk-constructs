import { Size } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import { Construct } from 'constructs';

interface TmEfsFileSystemProps {
  vpc: IVpc;
  provisionedThroughputPerSecond?: number;
  enableAutomaticBackups?: boolean;
  uid?: string;
  gid?: string;
  permissions?: string;
  allowAnonymousAccess?: boolean;
}

export class TmEfsFileSystem extends Construct {
  public readonly efsFileSystem: efs.FileSystem;
  public readonly efsAccessPoint: efs.AccessPoint;

  constructor(scope: Construct, id: string, props: TmEfsFileSystemProps) {
    super(scope, id);


    const defaultProps: TmEfsFileSystemProps = {
      vpc: props.vpc,
      provisionedThroughputPerSecond: props.provisionedThroughputPerSecond,
      enableAutomaticBackups: true,
      uid: '1000',
      gid: '1000',
      permissions: '755',
      allowAnonymousAccess: true,
    };
    const mergedProps = { ...defaultProps, ...props };

    const throughputMode = mergedProps.provisionedThroughputPerSecond
      ? efs.ThroughputMode.PROVISIONED
      : efs.ThroughputMode.BURSTING;

    this.efsFileSystem = new efs.FileSystem(this, 'EFSFilesystem', {
      vpc: mergedProps.vpc,
      encrypted: true,
      provisionedThroughputPerSecond: mergedProps.provisionedThroughputPerSecond
        ? Size.mebibytes(mergedProps.provisionedThroughputPerSecond)
        : undefined,
      enableAutomaticBackups: mergedProps.enableAutomaticBackups,
      throughputMode: throughputMode,
      allowAnonymousAccess: mergedProps.allowAnonymousAccess,
    });

    this.efsAccessPoint = new efs.AccessPoint(this, 'EFSAccessPoint', {
      fileSystem: this.efsFileSystem,
      createAcl: {
        ownerUid: mergedProps.uid!,
        ownerGid: mergedProps.gid!,
        permissions: mergedProps.permissions!,
      },
      posixUser: {
        uid: mergedProps.uid!,
        gid: mergedProps.gid!,
      },
      path: '/data',
    });
  }
}
