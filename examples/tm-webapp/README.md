# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

# Bootstrap projet

## Create a mirroring before begging the deploy

[GitLab to CodeCommit](https://docs.gitlab.com/ee/user/project/repository/mirror/push.html)
[Azure DevOps to CodeCommit](https://aws.amazon.com/blogs/devops/use-aws-codecommit-to-mirror-an-azure-devops-repository-using-an-azure-devops-pipeline/)

## Create SSM entries for each account that is going to be used

* Default repository branch  main `aws ssm put-parameter --name "repositoryBranch" --type "String" --value "main"`
* Default domain `aws ssm put-parameter --name "domain" --type "String" --value "main"`
* Create a vakye Secure `aws ssm put-parameter --name "secure-parameter-name" --type "SecureString" --value "secure-parameter-value"`