# CDK construct lib

Welcome to Toumoro's AWS Service Wrapper CDK Construct Library! This library is designed to make it easy and efficient to deploy and manage AWS services within your CDK projects. Whether you're provisioning infrastructure for a simple web application or orchestrating a complex cloud-native architecture, this library aims to streamline your development process by providing high-level constructs for common AWS services.

## Features
  - Simplified Service Provisioning: Easily create and configure AWS services using intuitive CDK constructs.
  - Best Practices Built-In: Leverage pre-configured settings and defaults based on AWS best practices to ensure reliable and secure deployments.
  - Modular and Extensible: Compose your infrastructure using modular constructs, allowing for flexibility and reusability across projects.

## TYPO3 web application

`TmPipelineStack` deploys a complete TYPO3 site through CDK Pipelines:
`TmWebappAppStage` assembles the VPC, bastion, Aurora MySQL, Redis, ECS,
backup stacks and, as configured, S3, service users, a baseline WebACL,
the www and CDN distributions and a redirection instance. An application
repository only keeps `bin/<app>.ts`, `environment-parameters.ts` and `cdk.json`:

```ts
// environment-parameters.ts
export const environmentParameters: EnvironmentParameters[] = [{
  account: '123456789012',
  environmentName: 'prod',
  vpc: { cidr: '10.3.0.0/16', hostedZoneName: 'example-site-web.internal' },
  ecs: { secretsFromSsmParameterStore: ['TM_DATABASE_NAME', 'TYPO3_CONTEXT'] },
  fal: { storage: FalStorage.S3 },
  serviceIamUsers: [ServiceIamUser.S3, ServiceIamUser.CLOUDFRONT],
  cloudfront: { domains: ['www.example.com'] },
  cdn: { domain: 'cdn.example.com' },
  waf: {},
}];

// bin/example.ts
const parameters = TmEnvironmentParameters.select(environmentParameters);
new TmPipelineStack(app, 'TmPipelineStack', {
  env: { account: parameters.account, region: parameters.region },
  parameters,
});
```

### Opt-in network, scaling and pipeline options

Every option below is off by default: an existing consumer deploys exactly
what it deployed before.

- `ecs.tasksInPrivateSubnets: true` runs the Fargate tasks and the post-deploy
  hook task in the **private subnets with egress** (NAT), without a public IP.
  Turning it on is a rolling update of the service (no downtime).
- `ecs.disableMemoryScaling: true` drops the memory target-tracking policy and
  scales on **CPU only**. A PHP-FPM task's memory utilization barely depends
  on the load, so a memory target either never fires or scales out to
  `maxTaskCount` and stays there.
- `cloudfront.vpcOrigin: true` makes the service load balancer **internal**,
  with an HTTPS 443 listener and an ACM certificate (DNS validation) for the
  www domains, and connects the distributions to it through a **CloudFront VPC
  origin**. A load balancer cannot change scheme in place, so on a deployed
  environment use the no-downtime path below rather than flipping this alone.
- `cloudfront.vpcOriginBridge: true` adds a second, internal HTTPS load
  balancer ("bridge") to the same service and makes it the VPC origin endpoint
  while `vpcOrigin` is false. **No-downtime migration**, one flag change per
  pipeline run, a serving load balancer at every moment:
  1. `vpcOriginBridge: true` (with `ecs.tasksInPrivateSubnets: true`): the
     bridge is created and CloudFront switches to a VPC origin on it; the
     public load balancer keeps serving until the new CloudFront configuration
     is live.
  2. `vpcOrigin: true`, `vpcOriginBridge: true`: the service load balancer is
     replaced by an internal one and CloudFront repoints to it, while the
     bridge carries the traffic.
  3. `vpcOrigin: true` alone: the bridge is removed.
- `redis.engine` / `redis.engineVersion` select Redis OSS (default `redis`
  `7.1`) or Valkey (e.g. `valkey` `9.1`, with a parameter group of the
  matching family). ElastiCache upgrades Redis OSS to Valkey in place.
- `fal.s3Driver` selects the TYPO3 extension reading the content bucket and
  therefore the variable names: `TM_S3ASSETS_*` (default, tm_s3assets,
  deprecated) or `TM_AUS_DRIVER_AMAZON_S3_*` (aus_driver_amazon_s3). With the
  latter and no `ServiceIamUser.S3`, no key is passed: the driver uses the
  ECS task role, which the stage grants read/write on the bucket.
- `pipeline.useRepositoryCdkCli: true` synthesizes with the repository's own
  `aws-cdk` devDependency (`npx cdk`) instead of a global install of the
  current version.
- The Solr instance role is scoped to what the tm-ansible playbook needs:
  SSM, pulling its image from ECR, describing volumes and instances, and
  attaching the volume tagged `solrdata` to the instance tagged
  `solrinstance`. No `AmazonEC2FullAccess`.

Stacks never import each other's CloudFormation exports: producers publish
their identifiers in SSM under `/tm/<env>/<component>/<resource>/<attribute>`
(`TmParameterNames`) and consumers read them at deploy time. Hand-made
inputs (certificate ARNs, the CloudFront origin header, application secrets
under `/applications/<app>/secrets/`) are read from SSM too; see the
`@default` of each setting in [API.md](API.md).

### Database bootstrap (opt-in)

A greenfield TYPO3 needs its schema before the ALB health check can pass. The
bootstrap feature automates that:

- `TmBootstrapAssetsStack` is a pipeline-level, versioned, RETAIN S3 bucket for
  bootstrap assets. The database dump lives at `db/latest.sql`. Instantiate it
  in `bin/<app>.ts` alongside `TmPipelineStack` so it deploys first — that is
  what gives you a window to upload the dump before the pipeline runs the stage.
- `rds.bootstrap = { enabled: true }` turns on a VPC-attached Lambda (Python +
  `pymysql`, bundled offline) in the RDS stack. It connects as the cluster admin
  (`cluster.secret`), creates the application database and user, sets the user's
  password from a **CDK-generated** secret, and imports `db/latest.sql`. It is
  idempotent (a sentinel table skips re-import) and a no-op on stack delete
  (data retained). Off by default, so other consumers (e.g. JARO) are untouched.

**Deploy order (hard requirement):**

1. Deploy the bootstrap-assets bucket stack first.
2. Upload the dump to `s3://<bucket>/db/latest.sql`.
3. Let the pipeline run the stage: the RDS stack imports the dump.

**The dump is required when bootstrap is enabled.** If it is missing, the Lambda
fails fast with a clear message (`bootstrap enabled but db/latest.sql not found
in bucket <name> — upload it before deploying`) rather than letting the stack
hang on a ten-minute ALB health-check timeout.

**Generated application password.** With bootstrap on, `TM_DATABASE_PASSWORD` is
no longer a human secret. The RDS stack generates it, publishes its ARN to
`/applications/<app>/generated/TM_DATABASE_PASSWORD-arn`, and both the bootstrap
Lambda and the ECS task read that **same ARN** (single source of truth). Remove
`TM_DATABASE_PASSWORD` from `ecs.secretsFromSecretsManager` and from the human
secret-seeding script — the stage rejects the synth if it is in both places.

**Import.** The dump is read as a stream and split by a tokenizer that
understands quoted strings (backslash escapes, doubled quotes), `--`/`#` and
`/* */` comments, MySQL `/*! */` conditional comments (executed) and
`DELIMITER`; statements are sent as the dump's exact bytes, so binary data is
untouched. Nothing is skipped silently: the few refused statements (`SET
@@GLOBAL`, `SQL_LOG_BIN`, `CREATE DATABASE`, `USE`) are logged one by one.
After the import the Lambda checks that **every table the dump creates
exists** and fails otherwise, listing the missing tables; the CloudFormation
result and the log carry the statement counts. Tables the dump does not
contain are, as before, created by the deployment hook
(`typo3 database:updateschema`).

**Lambda size/time ceiling.** The import streams from S3 (it never loads the
whole dump in memory), but the Lambda is bounded by the 15-minute timeout and
the `/tmp` 512 MB–10 GB limit. For a very large dump, run the import manually
from the bastion instead (it reaches the cluster on 3306) and let the sentinel
skip the Lambda import.

**VPC.** The Lambda needs Secrets Manager and S3. `TmVpcBase` only adds an S3
**gateway** endpoint, so the Lambda runs in the **private-with-egress** subnets
(reaching Secrets Manager and STS through the existing NAT, S3 through the
gateway endpoint). An isolated-subnet Lambda would instead require Secrets
Manager + STS interface endpoints (~$22/mo), which the VPC does not create.

# Contributing to CDK Construct Toumoro
[Contributing](CONTRIBUTING.md)

# Examples
[Examples](examples/README.md)

# Documentation API
[API](API.md)

# Developpement Guide

[AWS CDK Design Guidelines](https://github.com/aws/aws-cdk/blob/main/docs/DESIGN_GUIDELINES.md)

## Naming Conventions

1. *Prefixes*:
   - *Cfn* for CloudFormation resources.
   - *Fn* for constructs generating CloudFormation functions.
   - *As* for abstract classes.
   - *I* for interfaces.
   - *Vpc* for constructs related to Virtual Private Cloud.
   - *Lambda* for constructs related to AWS Lambda.
   - Example: CfnStack, FnSub, Aspects, IVpc, VpcNetwork, LambdaFunction.
2. *Construct Names*:
   - Use descriptive names that reflect the purpose of the construct.
   - CamelCase for multi-word names.
   - Avoid abbreviations unless they are widely understood.
   - Example: VpcBasic, RdsAuroraMysqlServerLess.
3. *Property Names*:
   - Follow AWS resource naming conventions where applicable.
   - Use camelCase for property names.
   - Use clear and concise names that reflect the purpose of the property.
   - Example: bucketName, vpcId, functionName.
4. *Method Names*:
   - Use verbs or verb phrases to describe actions performed by methods.
   - Use camelCase.
   - Example: addBucketPolicy, createVpc, invokeLambda.
5. *Interface Names*:
   - Interfaces begging uppercase I are reserverd to AWS CDK library.
   - Start with an prefix TmI
   - Use clear and descriptive names.
   - Example: TmIInstance, TmISecurityGroup, TmIVpc.
6. *Module Names*:
   - Use lowercase with hyphens for separating words.
   - Be descriptive but concise.
   - Follow a hierarchy if necessary, e.g., aws-cdk.aws_s3 for S3-related constructs.
   - Example: aws-cdk.aws_s3, aws-cdk.aws_ec2, aws-cdk.aws_lambda.
7. *Variable Names*:
   - Use descriptive names.
   - CamelCase for multi-word names.
   - Keep variable names concise but meaningful.
   - Example: instanceCount, subnetIds, roleArn.
8. *Enum and Constant Names*:
   - Use uppercase for constants.
   - CamelCase for multi-word names.
   - Be descriptive about the purpose of the constant or enum.
   - Example: MAX_RETRIES, HTTP_STATUS_CODES, VPC_CONFIG.
9. *File Names*:
   - Use lowercase with hyphens for separating words.
   - Reflect the content of the file.
   - Include version numbers if necessary.
   - Example: s3-bucket-stack.ts, vpc-network.ts, lambda-function.ts.
10. *Documentation Comments*:
    - Use JSDoc or similar conventions to provide clear documentation for each construct, method, property, etc.
    - Ensure that the documentation is up-to-date and accurately reflects the purpose and usage of the code.
