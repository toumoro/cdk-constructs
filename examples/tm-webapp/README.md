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

## Install packages

At the root of the project:
```
npm install
npx projen
```

[!WARNING]
Do not run npm install in the examples folder. There shall be only one node_modules folder at the root of the project.

## Deploy cdk bootstrap

```
cdk bootstrap
```

When adding a new region, you must bootstrap it by running the bootstrap command again.

## Create two CodeCommit repositories

* infrastructure
* application

## Configure mirroring if you wish to deploy from something else than CodeCommit

[GitLab to CodeCommit](https://docs.gitlab.com/ee/user/project/repository/mirror/push.html)
[Azure DevOps to CodeCommit](https://aws.amazon.com/blogs/devops/use-aws-codecommit-to-mirror-an-azure-devops-repository-using-an-azure-devops-pipeline/)

## Deploy

Before the first deploy, you need to create some parameters in Parameter Store:

| Parameter                                 | Description                                          |
|-------------------------------------------|------------------------------------------------------|
| branchNameParam                           | Name of the branch that will trigger the pipeline    |
| customHttpHeaderValue                     | Secret header between CloudFront and Load-Balancer   |
| domain                                    | Domain name for the application                      |
| hostedZoneId                              | Hosted Zone ID for the domain                        |


```
aws ssm put-parameter --name "<Parameter>" --type "String" --value "<Description>"
```
### Modifying removal policy to allow destuction of everything

We're using an aspect to apply the RETAIN policy to every resource in the application. Before destroying, we must deploy change it to DESTROY.

```
cdk deploy "**" --context removalPolicy=DESTROY --concurrency 10
```
Then we can destroy everything
```
cdk destroy "**" --concurrency 10
```
