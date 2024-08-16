import * as cdk from 'aws-cdk-lib';
import { aws_iam as iam, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * The TmServiceIamUsersWithCustomPermissionsStackProps interface defines the props
 * for the TmServiceIamUsersWithCustomPermissionsStack class.
 */
export interface TmServiceIamUsersStackProps extends cdk.StackProps {
    contentBucketArn: string;
    cloudfrontDistributionId: string;
}

export class TmServiceIamUsersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TmServiceIamUsersStackProps) {
    super(scope, id, props);


    const contentBucketArn = props.contentBucketArn;
    const cloudfrontDistributionArn = `arn:aws:cloudfront::${this.account}:distribution/${props.cloudfrontDistributionId}`;

    // Array of user configurations with different permissions
    const usersConfig = [
      {
        userName: 's3Service',
        policyStatements: [
          new iam.PolicyStatement({
            actions: [
              "s3:ListBucket",
              "s3:GetObject",
            ],
            resources: [contentBucketArn],
          }),
        ],
      },
      {
        userName: 'cloudfrontService',
        policyStatements: [
          new iam.PolicyStatement({
            actions: [
              "cloudfront:GetDistribution",

            ],
            resources: [cloudfrontDistributionArn],
          }),
        ],
      },
    ];

    usersConfig.forEach((config) => {
      // Create the IAM User
      const user = new iam.User(this, `${config.userName}User`);

      // Attach different policies to each user
      config.policyStatements.forEach((statement) => {
        user.addToPolicy(statement);
      });

      // Generate Access Key for the IAM User
      const accessKey = new iam.CfnAccessKey(this, `${config.userName}AccessKey`, {
        userName: user.userName,
      });

      // Store the Access Key ID in SSM Parameter Store
      new ssm.StringParameter(this, `${config.userName}-AccessKeyId`, {
        parameterName: `/ServiceIamUsers/Parameters/${config.userName}/AccessKeyId`,
        stringValue: accessKey.ref, // The access key ID
        tier: ssm.ParameterTier.STANDARD,       
      });

      // Store the Secret Access Key in SSM Parameter Store
      new ssm.StringParameter(this, `${config.userName}-SecretAccessKey`, {
        parameterName: `/ServiceIamUsers/Parameters/${config.userName}/SecretAccessKey`,
        stringValue: accessKey.attrSecretAccessKey, // The secret access key
        tier: ssm.ParameterTier.STANDARD,
        description: `The secret access key for ${config.userName}.`,
      });
    });
  }
}