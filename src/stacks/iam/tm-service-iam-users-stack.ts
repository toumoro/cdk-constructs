import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ServiceIamUser } from '../../config/enums';
import { TmParameterNames } from '../../config/parameter-names';
import { publishParameter, readParameter } from '../common/references';

/**
 * Props for `TmServiceIamUsersStack`.
 */
export interface TmServiceIamUsersStackProps extends cdk.StackProps {
  /**
   * Environment segment of the SSM parameter names.
   */
  readonly environmentName: string;

  /**
   * Users to create. `ServiceIamUser.S3` needs the content bucket of `TmS3Stack`.
   */
  readonly users: ServiceIamUser[];
}

/**
 * IAM users whose access keys TYPO3 uses (tm_s3assets, tm_cloudfront). Each
 * key is stored in a Secrets Manager secret (`AccessKeyId` and
 * `SecretAccessKey` fields) whose ARN is published in SSM.
 */
export class TmServiceIamUsersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TmServiceIamUsersStackProps) {
    super(scope, id, props);

    const env = props.environmentName;

    for (const user of props.users) {
      switch (user) {
        case ServiceIamUser.S3: {
          const bucketArn = `arn:${this.partition}:s3:::${readParameter(this, TmParameterNames.s3ContentBucketName(env))}`;
          this.addServiceUser(env, 's3Service', 's3-service', [
            new iam.PolicyStatement({
              actions: ['s3:ListBucket', 's3:GetBucketLocation', 's3:ListBucketMultipartUploads'],
              resources: [bucketArn],
            }),
            new iam.PolicyStatement({
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:GetObjectAcl',
                's3:PutObjectAcl',
                's3:AbortMultipartUpload',
                's3:ListMultipartUploadParts',
              ],
              resources: [`${bucketArn}/*`],
            }),
          ]);
          break;
        }
        case ServiceIamUser.CLOUDFRONT:
          // Scoped to the account's distributions: they are created after the
          // ECS stack, which needs these credentials.
          this.addServiceUser(env, 'cloudfrontService', 'cloudfront-service', [
            new iam.PolicyStatement({
              actions: [
                'cloudfront:CreateInvalidation',
                'cloudfront:GetDistribution',
                'cloudfront:GetInvalidation',
                'cloudfront:ListInvalidations',
              ],
              resources: [`arn:${this.partition}:cloudfront::${this.account}:distribution/*`],
            }),
          ]);
          break;
      }
    }
  }

  private addServiceUser(env: string, userName: string, resourceName: string, statements: iam.PolicyStatement[]) {
    const user = new iam.User(this, `${userName}User`);
    statements.forEach(statement => user.addToPolicy(statement));
    user.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // A new access key would rotate the credentials TYPO3 uses.
    const accessKey = new iam.CfnAccessKey(this, `${userName}AccessKey`, {
      userName: user.userName,
    });
    accessKey.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const credentials = new secretsmanager.Secret(this, `${userName}Credentials`, {
      description: `Access key of the ${userName} IAM user.`,
      secretObjectValue: {
        AccessKeyId: cdk.SecretValue.unsafePlainText(accessKey.ref),
        SecretAccessKey: cdk.SecretValue.resourceAttribute(accessKey.attrSecretAccessKey),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    publishParameter(this, `${userName}CredentialsSecretArnParameter`,
      TmParameterNames.serviceUserCredentialsSecretArn(env, resourceName), credentials.secretArn);
  }
}
