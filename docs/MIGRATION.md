# Migration guide

Two runbooks for repositories that already run in production:

1. [Converting an existing repository to `TmPipelineStack` / `TmWebappAppStage`](#1-converting-an-existing-repository)
2. [Moving from public tasks and a public load balancer to private tasks, an internal load balancer and a CloudFront VPC origin](#2-public-to-private-tasks-internal-load-balancer-and-cloudfront-vpc-origin)

Both follow the same rule: **one concern per deploy, each with its own `cdk
diff` gate, and a serving resource at every moment.** The programme-level plan
(phases, repository order, decisions) lives in the
`cdk-infrastructure-planning` repository; this document is the operational
runbook at the package level.

---

## 1. Converting an existing repository

### 1.1 What "existing" looks like

The hand-written repositories (opc, sqnim, chc, sqcsim, ciusss-odim, oqlf,
jaro…) share this shape:

```
lib/
  tm-app-stage.ts                  # the stage: ids like TmVpc<Region>Stack, TmRdsAurora<Region>, …
  tm-vpc-base-stack.ts             # TmVpcBase + PrivateHostedZone
  tm-bastion-stack.ts
  tm-rds-aurora-mysql-serverless-stack.ts   # publishes /RDS/Endpoint/Write, /RDS/Endpoint/Read, /RDS/Cluster/ARN
  tm-redis-stack.ts                # publishes /Redis/Endpoint/Primary
  tm-solr-ec2-construct-stack.ts   # TmSolrEc2 (recordName 'solr-ec2'), optional
  tm-solr-ansible-stack.ts         # AWS-ApplyAnsiblePlaybooks association, S3 source, optional
  tm-ecs-stack.ts                  # TmApplicationLoadBalancedFargateService, public ALB on HTTP 80
  tm-backup-stack.ts
  tm-pipeline-stack.ts             # CodeCommit source, /pipeline/parameters/branchName,
                                   # invalidation of /CloudFront/DistributionIds
```

Three traits matter for the conversion:

- **Stacks pass construct objects to each other** (`vpc.vpc`, `bastion.securityGroup`…), so
  CloudFormation wired them with **exports and `Fn::ImportValue`**. The package
  only uses **weak references** (SSM parameters named by `TmParameterNames`).
- **The construct ids are the same.** `TmWebappAppStage` was written from these
  stacks: `Vpc-CDK`, `PrivateHostedZone`, `BastionSecurityGroup`, `Bastion`,
  `Database`, `TmRedisCluster`, `servicePattern`, `SolrInstance`,
  `SolrSecurityGroup`, `CpuScaling`, `MemoryScaling`… produce the **same
  logical IDs**, so a correct conversion is an in-place update, never a
  replacement.
- **CloudFront, the WAF, the FAL bucket and the service IAM users are
  hand-made** (console) and only read through SSM (`/CloudFront/DistributionIds`,
  `/cloudfrontStack/parameters/customHttpHeader`, `/ServiceIamUsers/...`). They
  are **not** part of the conversion; they are imported later (`cdk import`,
  see the planning repository, Phase 6b / 7).

### 1.2 The gate

Every step below ends with the same check, run with the repository's read-only
profile from a workstation:

```bash
# before the change, on the untouched branch: must be clean (volatile values aside)
npx cdk diff '**' --no-color 2>&1 | tee baseline-diff.txt
# after the change
npx cdk diff '**' --no-color 2>&1 | tee step-diff.txt
```

- Select **every** stack (`'**'`): a bare `cdk diff` only shows `TmPipelineStack`
  and reports a false empty diff.
- **No `(requires replacement)` and no `[-]`/`[+]` pair on a stateful resource.**
  When `cdk diff` says `may be replaced` because it cannot resolve an SSM value,
  create a change set without executing it and read its `Replacement` column.
- Permanently ignored volatile values: the bastion `BastionAnsible` tag, the
  Solr Ansible association name, the deployment hook's `Updated at …` Lambda
  version, and Docker asset hashes.
- The pipeline deploys on merge. "Deploy" below means merging the step's branch.

### 1.3 Step A — pin the deployed behaviour (hand-written `lib/`)

Bump `tm-cdk-constructs` and `aws-cdk-lib` to the target versions **and**, in
the same change, set explicitly every value whose construct default moved
between the two versions, so the bump is a no-op. Known pins:

| Pin | Why |
|---|---|
| `targetCpuUtilizationPercent`, `targetMemoryUtilizationPercent` | the pattern's default went 50 → 30 at some point |
| `engineVersion` of the Redis cluster | the construct default moved (`7.1` today) |
| `instanceType` of RDS, `cacheNodeType` of Redis, `desiredCount`, `cpu`, `memoryLimitMiB` | whatever is deployed, even if it equals today's default |
| `RemovalPolicy.RETAIN` on RDS cluster + secret, Redis, EFS, buckets, IAM users and keys, the redirections EIP | makes every later revert safe; the package sets them too |

Gate: empty diff, except `DeletionPolicy` / `UpdateReplacePolicy` lines.

### 1.4 Step B1 — weak references, exports kept (hand-written `lib/`)

Still in the hand-written code, producers publish the **package's** parameter
names and consumers read them, while the old exports stay alive:

1. **Producers publish `TmParameterNames`.** Reuse the existing construct ids
   where the legacy stack already had a parameter (the id keeps the logical ID,
   the parameter is replaced under its new name, which is fine: an SSM parameter
   is stateless), add the missing ones with the ids the package uses:

   | Legacy parameter | Package parameter (`TmParameterNames`) | Construct id in the package |
   |---|---|---|
   | `/RDS/Endpoint/Write` | `rdsWriterEndpoint(env)` = `/tm/<env>/rds/cluster/writer-endpoint` | `clusterRdsWrite` |
   | `/RDS/Endpoint/Read` | `rdsReaderEndpoint(env)` | `clusterRdsRead` |
   | `/RDS/Cluster/ARN` | `rdsClusterArn(env)` | `clusterRdsArn` |
   | `/Redis/Endpoint/Primary` | `redisPrimaryEndpoint(env)` | `RedisPrimaryEndpoint` |
   | — | `rdsSecurityGroupId(env)`, `redisSecurityGroupId(env)`, `bastionSecurityGroupId(env)`, `solrSecurityGroupId(env)` | `SecurityGroupIdParameter` (each stack), `SolrSecurityGroupIdParameter` |
   | — | `vpcId`, `vpcPublicSubnetIds`, `vpcPrivateSubnetIds`, `vpcIsolatedSubnetIds`, `vpcHostedZoneId` | `VpcIdParameter`, `PublicSubnetIdsParameter`, `PrivateSubnetIdsParameter`, `IsolatedSubnetIdsParameter`, `HostedZoneIdParameter` |
   | `/Solr/env-construct/Endpoint/Writer` (kept: tm-ansible reads the `/Solr/env-construct/*` tree) | `solrWriterEndpoint(env)`, `solrWriterPort(env)` | `SolrWriterEndpointParameter`, `SolrWriterPortParameter` |
   | — | `ecsLoadBalancerDnsName(env)` | `LoadBalancerDnsNameParameter` |

   `<env>` is the `environmentName` the repository will use in
   `environment-parameters.ts` (`prod` for the fleet). If anything **outside the
   stacks** reads a legacy name (scripts, Ansible), keep that legacy parameter
   as an extra resource with a new construct id; the package will not recreate
   it, so it must then live in the stage extension (§1.6) or be retired.

2. **Consumers import through SSM** the way the package does
   (`src/stacks/common/references.ts`): `Vpc.fromVpcAttributes` with the subnet
   ID lists, `SecurityGroup.fromSecurityGroupId`, and **explicit
   `addDependency`** between stacks, since weak references create none.
   Keep every `AWS::EC2::SecurityGroupIngress` in the stack it lives in today
   (the ECS → RDS / Redis / Solr rules are in the ECS stack, bastion → RDS in
   the RDS stack, bastion → Redis in the Redis stack).

3. **Producers keep their exports** with `this.exportValue(...)` on the very same
   tokens, which reproduces the export names CDK generated. A typical follower
   has twelve:

   ```ts
   // TmVpcBaseStack
   this.exportValue(this.vpc.vpcId);
   this.exportValue(this.hostedZone.hostedZoneId);
   for (const s of [...this.vpc.publicSubnets, ...this.vpc.privateSubnets, ...this.vpc.isolatedSubnets]) {
     this.exportValue(s.subnetId);
   }
   // TmBastionStack, TmRdsAuroraMysqlServerlessStack, TmRedisStack, TmSolrEc2ConstructStack
   this.exportValue(this.securityGroup.securityGroupId);
   ```

   Check the list against the account, not against memory:

   ```bash
   aws cloudformation list-exports --query "Exports[?starts_with(Name,'AppStage-')].[Name,ExportingStackId]" --output table
   aws cloudformation list-imports --export-name <name>
   ```

Gate: new `AWS::SSM::Parameter` resources in producers, `Fn::ImportValue`
replaced by parameter references in consumers, **no replacement in any change
set**, no ingress rule changing stack.

### 1.5 Step B2 — drop the exports (hand-written `lib/`)

Once B1 is deployed and `list-imports` returns nothing for each export, delete
the `exportValue` calls. Gate: only `Outputs` removed. Reverting B1 after B2
is unsafe (the imports would come back against deleted exports): roll back
B2 then B1, in that order.

### 1.6 Step C — re-home onto the package

Replace `lib/` with the package and an `environment-parameters.ts` where
**every behaviour flag is explicit** (a deployed repository never relies on a
default). Mapping from the legacy stage:

| Legacy | `environment-parameters.ts` |
|---|---|
| `TmVpcBaseStack({ range, hostedZoneName })` | `vpc: { cidr, hostedZoneName }` (identity values verbatim, even a former project name) |
| `TmBastionStack({ bastionInstanceType })` | `bastion: { instanceType }` |
| RDS `provisionedInstanceType` | `rds: { instanceType: 't4g.medium', performanceInsights: true }` |
| Redis `cacheNodeType`, `replicasPerNodeGroup`, engine version | `redis: { cacheNodeType, replicasPerNodeGroup: 0, engine: 'redis', engineVersion: '7.1' }` |
| `TmSolrEc2ConstructStack({ instanceSize, ebsVolumeSize, recordName: 'solr-ec2' })` | `solr: { instanceType, ebsVolumeSize, recordName: 'solr-ec2', enabledCores, solrJavaMem, solrOpts }` and `stackIds: { solr: 'TmSolrEc2Construct<Region>Stack' }` |
| ECS `buildDockerfile: 'docker/php-apache/Dockerfile'` | `ecs: { containerTopology: ContainerTopology.SINGLE, webDockerfile: 'docker/php-apache/Dockerfile' }` |
| ECS `cpu`, `memoryLimitMiB`, `desiredCount`, `minTaskCount`, `maxTaskCount`, `scheduledTasksCommand`, scaling targets | same names under `ecs`, all explicit |
| `applicationName: 'tm'` | `ecs.applicationName: 'tm'` |
| `secretsFromSsmParameterStore: [...]` | `ecs.secretsFromSsmParameterStore`, **minus the names the stage now wires** (see below) |
| `additionalSecretsFromParameterStore: { TM_DATABASE_WRITER_HOSTNAME: '/RDS/Endpoint/Write', TM_REDIS_HOSTNAME: '/Redis/Endpoint/Primary', TM_SOLR_WRITER_HOSTNAME: '/Solr/env-construct/Endpoint/Writer', ... }` | **remove** those three (wired by `wireStageOutputs`); keep `TM_CLOUDFRONT_APIKEY`, `TM_CLOUDFRONT_APISECRET`, `TM_CLOUDFRONT_DISTRIBUTION_IDS` pointing at the legacy hand-made parameters |
| `customHttpHeaderParameterName: '/cloudfrontStack/parameters/customHttpHeader'` | no `cloudfront` block yet, so the ECS stack reads `TmParameterNames.cloudfrontOriginCustomHeader(env)`: **copy the legacy value to that name before deploying** (same value, so the listener rule does not change) |
| EFS `assets` volume only, FAL bucket hand-made | `fal: { storage: FalStorage.EFS, efsDirectories: [] }`: the `assets` volume as today, no FAL volume, **no bucket created**. `TM_S3ASSETS_*` stay in `secretsFromSsmParameterStore` (hand-seeded). Never change the FAL backend during a migration. |
| no CloudFront / S3 / IAM-users stack | `cloudfront`, `cdn`, `waf`, `serviceIamUsers` **absent** (imported later) |
| pipeline: CodeCommit, `/pipeline/parameters/branchName` | `pipeline: { sourceType: PipelineSourceType.CODECOMMIT }` (defaults match the legacy repository names) |

Names the stage wires itself (the synth refuses them in the hand-made lists):
`TM_DATABASE_WRITER_HOSTNAME`, `TM_REDIS_HOSTNAME`, `TM_SOLR_WRITER_HOSTNAME`,
`TM_SOLR_WRITER_PORT` (with `solr`), and with `FalStorage.S3` the
`TM_S3ASSETS_*` / `TM_AUS_DRIVER_AMAZON_S3_*` family.

**Repository-specific stacks** stay in a small `lib/` and are attached with
`appStageExtension`. Everything the package stage builds is exposed as public
read-only properties, so the extension can also amend a package stack:

```ts
new TmPipelineStack(app, 'TmPipelineStack', {
  env, parameters,
  stackIds: { solr: 'TmSolrEc2ConstructCaCentral1Stack' },
  appStageExtension: {
    extend: (stage) => {
      // The Solr Ansible association (S3 source) the legacy repo had as its own stack.
      const ansible = new TmSolrAnsible(stage, 'TmSolrAnsibleCaCentral1Stack', { env });
      ansible.addStackDependency(stage.solrStack!);
      // The legacy Solr stack also let the instance read the playbooks bucket.
      stage.solrStack!.instance.role.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: ['arn:aws:s3:::tm-ansible/playbooks/*'],
      }));
    },
  },
});
```

Do **not** touch `cdk.json` in this step: the feature flags change what CDK
synthesizes (an AL2023 flag alone replaces the bastion). Aligning flags is its
own later change.

Gate: empty diff, with two accepted additions the package always makes:
`ssm:GetParametersByPath` on the bastion role and the `DeletionPolicy: Retain`
lines not set in step A.

### 1.7 Step E — adopt the new defaults, on purpose

Remove the pins that merely reproduced an old default, one reviewed diff at a
time (autoscaling target, bastion → EFS ingress codified by the package, …).
A pin that is a deliberate choice stays.

### 1.8 Known gaps before converting a repository

Items the package does not cover yet; each needs a small package change or a
workaround decided per repository:

- **`COMPOSER_AUTH` as a Docker build argument.** Legacy ECS stacks pass
  `buildContainerArgs: { COMPOSER_AUTH: valueFromLookup(...) }`. `TmEcsStack`
  exposes no build args. Needed for repositories with private Composer
  packages.
- **CloudFront invalidation without a `cloudfront` block.** The pipeline's
  invalidation step only exists with `cloudfront`. A converted repository whose
  distributions are still hand-made loses the invalidation of
  `/CloudFront/DistributionIds` until Phase 6b imports them.
- **Playbooks bucket read for Solr** (`tm-ansible/playbooks/*`): done in the
  extension as shown above, or to be added as a `solr` setting.

---

## 2. Public to private: tasks, internal load balancer and CloudFront VPC origin

### 2.1 Where you start, where you end

Today (package default, and every converted repository):

- Fargate tasks in the **public** subnets with a public IP;
- a **public** application load balancer, HTTP 80, ingress from the CloudFront
  origin-facing prefix list, every request checked for the `X-Custom-Header`
  secret;
- CloudFront `HttpOrigin` on the load balancer's DNS name.

Target:

- tasks in the **private subnets with egress** (NAT), no public IP
  (`ecs.tasksInPrivateSubnets`);
- an **internal** load balancer in the private subnets, **HTTPS 443**, an ACM
  certificate for the www domains, ingress from the VPC only, the header still
  checked (`cloudfront.vpcOrigin`);
- a **CloudFront VPC origin** on that load balancer (`AWS::CloudFront::VpcOrigin`).

### 2.2 Why it takes three deploys

A load balancer's scheme (`internet-facing` → `internal`) is immutable:
CloudFormation **replaces** it, and the CloudFront stack only follows at the
next stack in the same pipeline run, hence an outage of several minutes if the
flag is flipped alone. `cloudfront.vpcOriginBridge` adds a **second, internal
HTTPS load balancer ("bridge") on the same service** so that one load balancer
serves at every moment:

| Run | `ecs.tasksInPrivateSubnets` | `cloudfront.vpcOrigin` | `cloudfront.vpcOriginBridge` | Result |
|---|---|---|---|---|
| 1 — bridge up | `true` | `false` | `true` | tasks roll to private subnets; bridge created, registered on the service and published as the VPC origin endpoint; CloudFront switches to the VPC origin → bridge. The public ALB keeps serving until the new CloudFront configuration is live. |
| 2 — switch | `true` | `true` | `true` | the service ALB is replaced by an internal one (new created, old public deleted) and becomes the endpoint; CloudFront repoints to it. The bridge carries the traffic throughout. |
| 3 — bridge down | `true` | `true` | `false` | bridge removed. End state. |

One flag change per pipeline run. Wait for the ECS **and** CloudFront stacks of
a run before starting the next.

### 2.3 Prerequisites

- **CloudFront is managed by the package** (`cloudfront` block present, the
  distribution deployed or imported). The VPC origin is built by
  `TmCloudfrontStack`; a hand-made distribution cannot follow.
- **Certificate validation.** The ECS stack creates an ACM certificate in the
  application region for the www domains (`domains` + `additionalDomains`) with
  DNS validation. ACM issues the **same validation CNAME** for the same domain
  in the same account, so if the us-east-1 certificate of the distribution is
  already validated (`createCertificate`, or a hand-validated one), validation
  completes on its own. For a domain validated nowhere yet, add its CNAME first
  or the ECS stack waits on the certificate.
- **The viewer `Host` header reaches the load balancer.** CloudFront validates
  the origin certificate against the forwarded `Host`; the package cache policy
  forwards it. A custom cache policy must keep `Host` in its allow-list.
- **NAT gateway** in the VPC (`TmVpcBase` has one): private tasks and the
  bridge need it for ECR, Secrets Manager and outbound calls.
- The **CloudFront → ALB header** stays required on every listener, public,
  bridge and internal alike.

### 2.4 Run 1 — bridge up

`environment-parameters.ts`:

```ts
ecs: { ..., tasksInPrivateSubnets: true },
cloudfront: { ..., vpcOrigin: false, vpcOriginBridge: true },
```

Expected `cdk diff` on the ECS stack (verified on epq):

- `servicePatternLB…`, its listener and target group: **unchanged** (no replace);
- `[~] AWS::ECS::Service`: `LoadBalancers` gains the bridge target group,
  `NetworkConfiguration` moves to the private subnet IDs with
  `AssignPublicIp: DISABLED` (in place, rolling);
- `[~] AWS::ECS::TaskDefinition … replace` (new revision, normal);
- `[+] VpcOriginBridge…` load balancer, `Https` listener, `ServiceGroup` target
  group, `ServiceRule` listener rule with the header condition,
  `VpcOriginBridgeSecurityGroup` (443 from the CloudFront origin-facing prefix
  list only), the service security
  group ingress from it on the container port;
- `[+] LoadBalancerCertificate`;
- `[+]` SSM `/tm/<env>/ecs/vpc-origin/load-balancer-arn` and
  `.../load-balancer-dns-name` → the bridge.

Expected diff on the CloudFront stack: `[+] BridgeVpcOrigin…` (`AWS::CloudFront::VpcOrigin`), and
the distribution's origin loses `CustomOriginConfig` for `VpcOriginConfig`
(in place). The old `ecs/load-balancer/dns-name` parameter is no longer read.

Verify after the run:

```bash
aws cloudfront list-vpc-origins --query 'VpcOriginList.Items[].[Name,Status]' --output table
aws elbv2 describe-target-health --target-group-arn <bridge target group>     # healthy tasks
curl -sI https://www.example.com/ | head -1                                   # 200 through the bridge
```

The public load balancer still exists and still answers; it simply receives
no traffic any more.

### 2.5 Run 2 — switch

```ts
cloudfront: { ..., vpcOrigin: true, vpcOriginBridge: true },
```

Expected diff on the ECS stack:

- `servicePatternLB… replace` (`Scheme`), its listener recreated on 443/HTTPS
  with the shared certificate, a new target group (`ECSPrivate…` under the
  `uniqueTargetGroupId` flag), the ALB security group ingress moves from 80 to
  443, still from the CloudFront origin-facing prefix list;
- `[~] AWS::ECS::Service` in place: the new target group replaces the old one,
  the bridge target group stays;
- the two `vpc-origin` SSM parameters now point at the service load balancer;
- the public subnet parameters are no longer imported.

CloudFormation creates the new load balancer before deleting the old one, and
the bridge serves during the whole update.

Expected diff on the CloudFront stack: `[+] ServiceVpcOrigin…`,
`[-] BridgeVpcOrigin…`, and the distribution's `VpcOriginId` changes in place.
CloudFront refuses to modify a VPC origin that a distribution uses (`409 The
specified VPC origin is currently associated with one or more distributions`),
so the stack creates a second VPC origin on the service load balancer, moves
the distribution to it, and deletes the bridge's VPC origin in the cleanup
phase. Expect the stack to take a while: CloudFormation waits for the new VPC
origin, then for the distribution, to be deployed. Verify as in run 1; the public load balancer is
gone (`describe-load-balancers` lists two internal ones).

### 2.6 Run 3 — bridge down

```ts
cloudfront: { ..., vpcOrigin: true, vpcOriginBridge: false },
```

Expected diff: `[-]` on every `VpcOriginBridge*` resource, the service loses
the bridge target group in place. CloudFront already points at the service
load balancer; nothing else changes.

### 2.7 Rollback

The forward path is outage-free at every run; rollbacks are not all equal,
because the pipeline deploys the ECS stack **before** the CloudFront stack:

- **after run 2** (`vpcOrigin: false`, bridge kept): outage-free. The ECS
  stack recreates a public load balancer while the bridge keeps serving, the
  SSM endpoint parameters go back to the bridge, and CloudFront repoints to it.
- **after run 1** (`vpcOriginBridge: false`): **a few minutes of errors.** The
  ECS stack deletes the bridge first, and CloudFront only returns to the public
  load balancer when its own stack deploys. If the bridge works, prefer going
  forward to run 2 over rolling back.
- **after run 3** there is no bridge to fall back on: run the sequence
  backwards (bridge up with `vpcOrigin: true` + `vpcOriginBridge: true`, then
  `vpcOrigin: false`, then remove the bridge), accepting the window above on
  the last step.

### 2.8 Notes

- **Cost of the migration:** one extra application load balancer for the
  duration of runs 1 to 3 (about 20 USD/month pro rata).
- **A VPC origin cannot change while in use.** Each endpoint has its own
  resource (`BridgeVpcOrigin`, `ServiceVpcOrigin`) with a name generated from
  the construct path, unique per stage and account. Anything else that would
  modify the VPC origin in place (its endpoint ARN, port or TLS protocols, for
  example if the service load balancer is replaced for another reason) fails
  with the same 409: give the VPC origin a new construct ID in that change.
- **Security groups.** CloudFront creates the VPC origin ENIs in the load
  balancer's subnets, but the traffic does **not** arrive from VPC addresses: a
  "443 from the VPC CIDR" rule never matches and CloudFront answers 504. AWS
  documents two options: the `com.amazonaws.global.cloudfront.origin-facing`
  prefix list (what the package uses, for the service load balancer and the
  bridge), or the service-managed `CloudFront-VPCOrigins-Service-SG`, which only
  exists once a VPC origin does and so cannot be referenced on a first deploy.
  The prefix list weighs about 55 rules against the 60-rule security group
  quota.
- **Flipping `vpcOrigin` without the bridge** on a deployed environment is a
  planned outage of several minutes between the ECS and CloudFront stacks. It
  is only acceptable before go-live.
- **`tasksInPrivateSubnets` alone** is a safe, independent first step on any
  repository: it is a rolling update of the service, and it does not change the
  load balancer.
