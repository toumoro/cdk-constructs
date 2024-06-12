# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### TmPipeline <a name="TmPipeline" id="tm-cdk-constructs.TmPipeline"></a>

A CDK construct that creates a CodePipeline.

#### Initializers <a name="Initializers" id="tm-cdk-constructs.TmPipeline.Initializer"></a>

```typescript
import { TmPipeline } from 'tm-cdk-constructs'

new TmPipeline(scope: Construct, id: string, props: TmPipelineProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmPipeline.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | The parent construct. |
| <code><a href="#tm-cdk-constructs.TmPipeline.Initializer.parameter.id">id</a></code> | <code>string</code> | The name of the construct. |
| <code><a href="#tm-cdk-constructs.TmPipeline.Initializer.parameter.props">props</a></code> | <code><a href="#tm-cdk-constructs.TmPipelineProps">TmPipelineProps</a></code> | The properties for the construct. |

---

##### `scope`<sup>Required</sup> <a name="scope" id="tm-cdk-constructs.TmPipeline.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

The parent construct.

---

##### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmPipeline.Initializer.parameter.id"></a>

- *Type:* string

The name of the construct.

---

##### `props`<sup>Required</sup> <a name="props" id="tm-cdk-constructs.TmPipeline.Initializer.parameter.props"></a>

- *Type:* <a href="#tm-cdk-constructs.TmPipelineProps">TmPipelineProps</a>

The properties for the construct.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#tm-cdk-constructs.TmPipeline.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="tm-cdk-constructs.TmPipeline.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#tm-cdk-constructs.TmPipeline.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="tm-cdk-constructs.TmPipeline.isConstruct"></a>

```typescript
import { TmPipeline } from 'tm-cdk-constructs'

TmPipeline.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="tm-cdk-constructs.TmPipeline.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmPipeline.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#tm-cdk-constructs.TmPipeline.property.pipeline">pipeline</a></code> | <code>aws-cdk-lib.pipelines.CodePipeline</code> | The CodePipeline created by the construct. |

---

##### `node`<sup>Required</sup> <a name="node" id="tm-cdk-constructs.TmPipeline.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `pipeline`<sup>Required</sup> <a name="pipeline" id="tm-cdk-constructs.TmPipeline.property.pipeline"></a>

```typescript
public readonly pipeline: CodePipeline;
```

- *Type:* aws-cdk-lib.pipelines.CodePipeline

The CodePipeline created by the construct.

---


### TmRdsAuroraMysqlServerless <a name="TmRdsAuroraMysqlServerless" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless"></a>

#### Initializers <a name="Initializers" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.Initializer"></a>

```typescript
import { TmRdsAuroraMysqlServerless } from 'tm-cdk-constructs'

new TmRdsAuroraMysqlServerless(scope: Construct, id: string, props?: TmRdsAuroraMysqlServerlessProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.Initializer.parameter.props">props</a></code> | <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps">TmRdsAuroraMysqlServerlessProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.Initializer.parameter.props"></a>

- *Type:* <a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps">TmRdsAuroraMysqlServerlessProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.addProxy">addProxy</a></code> | Add a new db proxy to this cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.asSecretAttachmentTarget">asSecretAttachmentTarget</a></code> | Renders the secret attachment target specifications. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.grantConnect">grantConnect</a></code> | Grant the given identity connection access to the Cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.grantDataApiAccess">grantDataApiAccess</a></code> | Grant the given identity to access the Data API. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metric">metric</a></code> | Return the given named metric for this DBCluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricCPUUtilization">metricCPUUtilization</a></code> | The percentage of CPU utilization. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricDatabaseConnections">metricDatabaseConnections</a></code> | The number of database connections in use. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricDeadlocks">metricDeadlocks</a></code> | The average number of deadlocks in the database per second. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricEngineUptime">metricEngineUptime</a></code> | The amount of time that the instance has been running, in seconds. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricFreeableMemory">metricFreeableMemory</a></code> | The amount of available random access memory, in bytes. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricFreeLocalStorage">metricFreeLocalStorage</a></code> | The amount of local storage available, in bytes. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkReceiveThroughput">metricNetworkReceiveThroughput</a></code> | The amount of network throughput received from clients by each instance, in bytes per second. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkThroughput">metricNetworkThroughput</a></code> | The amount of network throughput both received from and transmitted to clients by each instance, in bytes per second. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkTransmitThroughput">metricNetworkTransmitThroughput</a></code> | The amount of network throughput sent to clients by each instance, in bytes per second. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricSnapshotStorageUsed">metricSnapshotStorageUsed</a></code> | The total amount of backup storage in bytes consumed by all Aurora snapshots outside its backup retention window. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricTotalBackupStorageBilled">metricTotalBackupStorageBilled</a></code> | The total amount of backup storage in bytes for which you are billed. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeBytesUsed">metricVolumeBytesUsed</a></code> | The amount of storage used by your Aurora DB instance, in bytes. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeReadIOPs">metricVolumeReadIOPs</a></code> | The number of billed read I/O operations from a cluster volume, reported at 5-minute intervals. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeWriteIOPs">metricVolumeWriteIOPs</a></code> | The number of write disk I/O operations to the cluster volume, reported at 5-minute intervals. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.addRotationMultiUser">addRotationMultiUser</a></code> | Adds the multi user rotation to this cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.addRotationSingleUser">addRotationSingleUser</a></code> | Adds the single user rotation of the master password to this cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricACUUtilization">metricACUUtilization</a></code> | This value is represented as a percentage. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricServerlessDatabaseCapacity">metricServerlessDatabaseCapacity</a></code> | As a cluster-level metric, it represents the average of the ServerlessDatabaseCapacity values of all the Aurora Serverless v2 DB instances in the cluster. |

---

##### `toString` <a name="toString" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `addProxy` <a name="addProxy" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addProxy"></a>

```typescript
public addProxy(id: string, options: DatabaseProxyOptions): DatabaseProxy
```

Add a new db proxy to this cluster.

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addProxy.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addProxy.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_rds.DatabaseProxyOptions

---

##### `asSecretAttachmentTarget` <a name="asSecretAttachmentTarget" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.asSecretAttachmentTarget"></a>

```typescript
public asSecretAttachmentTarget(): SecretAttachmentTargetProps
```

Renders the secret attachment target specifications.

##### `grantConnect` <a name="grantConnect" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.grantConnect"></a>

```typescript
public grantConnect(grantee: IGrantable, dbUser: string): Grant
```

Grant the given identity connection access to the Cluster.

###### `grantee`<sup>Required</sup> <a name="grantee" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.grantConnect.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

###### `dbUser`<sup>Required</sup> <a name="dbUser" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.grantConnect.parameter.dbUser"></a>

- *Type:* string

---

##### `grantDataApiAccess` <a name="grantDataApiAccess" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.grantDataApiAccess"></a>

```typescript
public grantDataApiAccess(grantee: IGrantable): Grant
```

Grant the given identity to access the Data API.

###### `grantee`<sup>Required</sup> <a name="grantee" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.grantDataApiAccess.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

##### `metric` <a name="metric" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metric"></a>

```typescript
public metric(metricName: string, props?: MetricOptions): Metric
```

Return the given named metric for this DBCluster.

###### `metricName`<sup>Required</sup> <a name="metricName" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metric.parameter.metricName"></a>

- *Type:* string

---

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metric.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricCPUUtilization` <a name="metricCPUUtilization" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricCPUUtilization"></a>

```typescript
public metricCPUUtilization(props?: MetricOptions): Metric
```

The percentage of CPU utilization.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricCPUUtilization.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricDatabaseConnections` <a name="metricDatabaseConnections" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricDatabaseConnections"></a>

```typescript
public metricDatabaseConnections(props?: MetricOptions): Metric
```

The number of database connections in use.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricDatabaseConnections.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricDeadlocks` <a name="metricDeadlocks" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricDeadlocks"></a>

```typescript
public metricDeadlocks(props?: MetricOptions): Metric
```

The average number of deadlocks in the database per second.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricDeadlocks.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricEngineUptime` <a name="metricEngineUptime" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricEngineUptime"></a>

```typescript
public metricEngineUptime(props?: MetricOptions): Metric
```

The amount of time that the instance has been running, in seconds.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricEngineUptime.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricFreeableMemory` <a name="metricFreeableMemory" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricFreeableMemory"></a>

```typescript
public metricFreeableMemory(props?: MetricOptions): Metric
```

The amount of available random access memory, in bytes.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricFreeableMemory.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricFreeLocalStorage` <a name="metricFreeLocalStorage" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricFreeLocalStorage"></a>

```typescript
public metricFreeLocalStorage(props?: MetricOptions): Metric
```

The amount of local storage available, in bytes.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricFreeLocalStorage.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricNetworkReceiveThroughput` <a name="metricNetworkReceiveThroughput" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkReceiveThroughput"></a>

```typescript
public metricNetworkReceiveThroughput(props?: MetricOptions): Metric
```

The amount of network throughput received from clients by each instance, in bytes per second.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkReceiveThroughput.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricNetworkThroughput` <a name="metricNetworkThroughput" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkThroughput"></a>

```typescript
public metricNetworkThroughput(props?: MetricOptions): Metric
```

The amount of network throughput both received from and transmitted to clients by each instance, in bytes per second.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkThroughput.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricNetworkTransmitThroughput` <a name="metricNetworkTransmitThroughput" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkTransmitThroughput"></a>

```typescript
public metricNetworkTransmitThroughput(props?: MetricOptions): Metric
```

The amount of network throughput sent to clients by each instance, in bytes per second.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricNetworkTransmitThroughput.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricSnapshotStorageUsed` <a name="metricSnapshotStorageUsed" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricSnapshotStorageUsed"></a>

```typescript
public metricSnapshotStorageUsed(props?: MetricOptions): Metric
```

The total amount of backup storage in bytes consumed by all Aurora snapshots outside its backup retention window.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricSnapshotStorageUsed.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricTotalBackupStorageBilled` <a name="metricTotalBackupStorageBilled" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricTotalBackupStorageBilled"></a>

```typescript
public metricTotalBackupStorageBilled(props?: MetricOptions): Metric
```

The total amount of backup storage in bytes for which you are billed.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricTotalBackupStorageBilled.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricVolumeBytesUsed` <a name="metricVolumeBytesUsed" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeBytesUsed"></a>

```typescript
public metricVolumeBytesUsed(props?: MetricOptions): Metric
```

The amount of storage used by your Aurora DB instance, in bytes.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeBytesUsed.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricVolumeReadIOPs` <a name="metricVolumeReadIOPs" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeReadIOPs"></a>

```typescript
public metricVolumeReadIOPs(props?: MetricOptions): Metric
```

The number of billed read I/O operations from a cluster volume, reported at 5-minute intervals.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeReadIOPs.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricVolumeWriteIOPs` <a name="metricVolumeWriteIOPs" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeWriteIOPs"></a>

```typescript
public metricVolumeWriteIOPs(props?: MetricOptions): Metric
```

The number of write disk I/O operations to the cluster volume, reported at 5-minute intervals.

Average over 5 minutes

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricVolumeWriteIOPs.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `addRotationMultiUser` <a name="addRotationMultiUser" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addRotationMultiUser"></a>

```typescript
public addRotationMultiUser(id: string, options: RotationMultiUserOptions): SecretRotation
```

Adds the multi user rotation to this cluster.

See [Alternating users rotation strategy](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets_strategies.html#rotating-secrets-two-users)

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addRotationMultiUser.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addRotationMultiUser.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_rds.RotationMultiUserOptions

---

##### `addRotationSingleUser` <a name="addRotationSingleUser" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addRotationSingleUser"></a>

```typescript
public addRotationSingleUser(options?: RotationSingleUserOptions): SecretRotation
```

Adds the single user rotation of the master password to this cluster.

See [Single user rotation strategy](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets_strategies.html#rotating-secrets-one-user-one-password)

###### `options`<sup>Optional</sup> <a name="options" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.addRotationSingleUser.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_rds.RotationSingleUserOptions

---

##### `metricACUUtilization` <a name="metricACUUtilization" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricACUUtilization"></a>

```typescript
public metricACUUtilization(props?: MetricOptions): Metric
```

This value is represented as a percentage.

It's calculated as the value of the
ServerlessDatabaseCapacity metric divided by the maximum ACU value of the DB cluster.

If this metric approaches a value of 100.0, the DB instance has scaled up as high as it can.
Consider increasing the maximum ACU setting for the cluster.

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricACUUtilization.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

##### `metricServerlessDatabaseCapacity` <a name="metricServerlessDatabaseCapacity" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricServerlessDatabaseCapacity"></a>

```typescript
public metricServerlessDatabaseCapacity(props?: MetricOptions): Metric
```

As a cluster-level metric, it represents the average of the ServerlessDatabaseCapacity values of all the Aurora Serverless v2 DB instances in the cluster.

###### `props`<sup>Optional</sup> <a name="props" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.metricServerlessDatabaseCapacity.parameter.props"></a>

- *Type:* aws-cdk-lib.aws_cloudwatch.MetricOptions

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.fromDatabaseClusterAttributes">fromDatabaseClusterAttributes</a></code> | Import an existing DatabaseCluster from properties. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.isConstruct"></a>

```typescript
import { TmRdsAuroraMysqlServerless } from 'tm-cdk-constructs'

TmRdsAuroraMysqlServerless.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.isOwnedResource"></a>

```typescript
import { TmRdsAuroraMysqlServerless } from 'tm-cdk-constructs'

TmRdsAuroraMysqlServerless.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.isResource"></a>

```typescript
import { TmRdsAuroraMysqlServerless } from 'tm-cdk-constructs'

TmRdsAuroraMysqlServerless.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromDatabaseClusterAttributes` <a name="fromDatabaseClusterAttributes" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.fromDatabaseClusterAttributes"></a>

```typescript
import { TmRdsAuroraMysqlServerless } from 'tm-cdk-constructs'

TmRdsAuroraMysqlServerless.fromDatabaseClusterAttributes(scope: Construct, id: string, attrs: DatabaseClusterAttributes)
```

Import an existing DatabaseCluster from properties.

###### `scope`<sup>Required</sup> <a name="scope" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.fromDatabaseClusterAttributes.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.fromDatabaseClusterAttributes.parameter.id"></a>

- *Type:* string

---

###### `attrs`<sup>Required</sup> <a name="attrs" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.fromDatabaseClusterAttributes.parameter.attrs"></a>

- *Type:* aws-cdk-lib.aws_rds.DatabaseClusterAttributes

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterArn">clusterArn</a></code> | <code>string</code> | The ARN of the cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterEndpoint">clusterEndpoint</a></code> | <code>aws-cdk-lib.aws_rds.Endpoint</code> | The endpoint to use for read/write operations. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterIdentifier">clusterIdentifier</a></code> | <code>string</code> | Identifier of the cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterReadEndpoint">clusterReadEndpoint</a></code> | <code>aws-cdk-lib.aws_rds.Endpoint</code> | Endpoint to use for load-balanced read-only operations. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterResourceIdentifier">clusterResourceIdentifier</a></code> | <code>string</code> | The immutable identifier for the cluster; for example: cluster-ABCD1234EFGH5678IJKL90MNOP. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.connections">connections</a></code> | <code>aws-cdk-lib.aws_ec2.Connections</code> | Access to the network connections. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.instanceEndpoints">instanceEndpoints</a></code> | <code>aws-cdk-lib.aws_rds.Endpoint[]</code> | Endpoints which address each individual replica. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.instanceIdentifiers">instanceIdentifiers</a></code> | <code>string[]</code> | Identifiers of the replicas. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.engine">engine</a></code> | <code>aws-cdk-lib.aws_rds.IClusterEngine</code> | The engine for this Cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.secret">secret</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | The secret attached to this cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.cloudwatchLogGroups">cloudwatchLogGroups</a></code> | <code>{[ key: string ]: aws-cdk-lib.aws_logs.ILogGroup}</code> | The log group is created when `cloudwatchLogsExports` is set. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.multiUserRotationApplication">multiUserRotationApplication</a></code> | <code>aws-cdk-lib.aws_secretsmanager.SecretRotationApplication</code> | Application for multi user rotation to this cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.singleUserRotationApplication">singleUserRotationApplication</a></code> | <code>aws-cdk-lib.aws_secretsmanager.SecretRotationApplication</code> | Application for single user rotation of the master password to this cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | The VPC network to place the cluster in. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | The cluster's subnets. |

---

##### `node`<sup>Required</sup> <a name="node" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `clusterArn`<sup>Required</sup> <a name="clusterArn" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterArn"></a>

```typescript
public readonly clusterArn: string;
```

- *Type:* string

The ARN of the cluster.

---

##### `clusterEndpoint`<sup>Required</sup> <a name="clusterEndpoint" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterEndpoint"></a>

```typescript
public readonly clusterEndpoint: Endpoint;
```

- *Type:* aws-cdk-lib.aws_rds.Endpoint

The endpoint to use for read/write operations.

---

##### `clusterIdentifier`<sup>Required</sup> <a name="clusterIdentifier" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterIdentifier"></a>

```typescript
public readonly clusterIdentifier: string;
```

- *Type:* string

Identifier of the cluster.

---

##### `clusterReadEndpoint`<sup>Required</sup> <a name="clusterReadEndpoint" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterReadEndpoint"></a>

```typescript
public readonly clusterReadEndpoint: Endpoint;
```

- *Type:* aws-cdk-lib.aws_rds.Endpoint

Endpoint to use for load-balanced read-only operations.

---

##### `clusterResourceIdentifier`<sup>Required</sup> <a name="clusterResourceIdentifier" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.clusterResourceIdentifier"></a>

```typescript
public readonly clusterResourceIdentifier: string;
```

- *Type:* string

The immutable identifier for the cluster; for example: cluster-ABCD1234EFGH5678IJKL90MNOP.

This AWS Region-unique identifier is used in things like IAM authentication policies.

---

##### `connections`<sup>Required</sup> <a name="connections" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.connections"></a>

```typescript
public readonly connections: Connections;
```

- *Type:* aws-cdk-lib.aws_ec2.Connections

Access to the network connections.

---

##### `instanceEndpoints`<sup>Required</sup> <a name="instanceEndpoints" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.instanceEndpoints"></a>

```typescript
public readonly instanceEndpoints: Endpoint[];
```

- *Type:* aws-cdk-lib.aws_rds.Endpoint[]

Endpoints which address each individual replica.

---

##### `instanceIdentifiers`<sup>Required</sup> <a name="instanceIdentifiers" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.instanceIdentifiers"></a>

```typescript
public readonly instanceIdentifiers: string[];
```

- *Type:* string[]

Identifiers of the replicas.

---

##### `engine`<sup>Optional</sup> <a name="engine" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.engine"></a>

```typescript
public readonly engine: IClusterEngine;
```

- *Type:* aws-cdk-lib.aws_rds.IClusterEngine

The engine for this Cluster.

Never undefined.

---

##### `secret`<sup>Optional</sup> <a name="secret" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.secret"></a>

```typescript
public readonly secret: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

The secret attached to this cluster.

---

##### `cloudwatchLogGroups`<sup>Required</sup> <a name="cloudwatchLogGroups" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.cloudwatchLogGroups"></a>

```typescript
public readonly cloudwatchLogGroups: {[ key: string ]: ILogGroup};
```

- *Type:* {[ key: string ]: aws-cdk-lib.aws_logs.ILogGroup}

The log group is created when `cloudwatchLogsExports` is set.

Each export value will create a separate log group.

---

##### `multiUserRotationApplication`<sup>Required</sup> <a name="multiUserRotationApplication" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.multiUserRotationApplication"></a>

```typescript
public readonly multiUserRotationApplication: SecretRotationApplication;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.SecretRotationApplication

Application for multi user rotation to this cluster.

---

##### `singleUserRotationApplication`<sup>Required</sup> <a name="singleUserRotationApplication" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.singleUserRotationApplication"></a>

```typescript
public readonly singleUserRotationApplication: SecretRotationApplication;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.SecretRotationApplication

Application for single user rotation of the master password to this cluster.

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

The VPC network to place the cluster in.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="tm-cdk-constructs.TmRdsAuroraMysqlServerless.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection

The cluster's subnets.

---


### TmVpcBase <a name="TmVpcBase" id="tm-cdk-constructs.TmVpcBase"></a>

A VPC construct that creates a VPC with public and private subnets.

#### Initializers <a name="Initializers" id="tm-cdk-constructs.TmVpcBase.Initializer"></a>

```typescript
import { TmVpcBase } from 'tm-cdk-constructs'

new TmVpcBase(scope: Construct, id: string, props: TmVpcProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmVpcBase.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmVpcBase.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmVpcBase.Initializer.parameter.props">props</a></code> | <code><a href="#tm-cdk-constructs.TmVpcProps">TmVpcProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="tm-cdk-constructs.TmVpcBase.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="tm-cdk-constructs.TmVpcBase.Initializer.parameter.props"></a>

- *Type:* <a href="#tm-cdk-constructs.TmVpcProps">TmVpcProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#tm-cdk-constructs.TmVpcBase.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.addClientVpnEndpoint">addClientVpnEndpoint</a></code> | Adds a new client VPN endpoint to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.addFlowLog">addFlowLog</a></code> | Adds a new flow log to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.addGatewayEndpoint">addGatewayEndpoint</a></code> | Adds a new gateway endpoint to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.addInterfaceEndpoint">addInterfaceEndpoint</a></code> | Adds a new interface endpoint to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.addVpnConnection">addVpnConnection</a></code> | Adds a new VPN connection to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.enableVpnGateway">enableVpnGateway</a></code> | Adds a VPN Gateway to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.selectSubnets">selectSubnets</a></code> | Returns IDs of selected subnets. |

---

##### `toString` <a name="toString" id="tm-cdk-constructs.TmVpcBase.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="tm-cdk-constructs.TmVpcBase.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="tm-cdk-constructs.TmVpcBase.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `addClientVpnEndpoint` <a name="addClientVpnEndpoint" id="tm-cdk-constructs.TmVpcBase.addClientVpnEndpoint"></a>

```typescript
public addClientVpnEndpoint(id: string, options: ClientVpnEndpointOptions): ClientVpnEndpoint
```

Adds a new client VPN endpoint to this VPC.

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.addClientVpnEndpoint.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmVpcBase.addClientVpnEndpoint.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_ec2.ClientVpnEndpointOptions

---

##### `addFlowLog` <a name="addFlowLog" id="tm-cdk-constructs.TmVpcBase.addFlowLog"></a>

```typescript
public addFlowLog(id: string, options?: FlowLogOptions): FlowLog
```

Adds a new flow log to this VPC.

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.addFlowLog.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Optional</sup> <a name="options" id="tm-cdk-constructs.TmVpcBase.addFlowLog.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_ec2.FlowLogOptions

---

##### `addGatewayEndpoint` <a name="addGatewayEndpoint" id="tm-cdk-constructs.TmVpcBase.addGatewayEndpoint"></a>

```typescript
public addGatewayEndpoint(id: string, options: GatewayVpcEndpointOptions): GatewayVpcEndpoint
```

Adds a new gateway endpoint to this VPC.

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.addGatewayEndpoint.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmVpcBase.addGatewayEndpoint.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_ec2.GatewayVpcEndpointOptions

---

##### `addInterfaceEndpoint` <a name="addInterfaceEndpoint" id="tm-cdk-constructs.TmVpcBase.addInterfaceEndpoint"></a>

```typescript
public addInterfaceEndpoint(id: string, options: InterfaceVpcEndpointOptions): InterfaceVpcEndpoint
```

Adds a new interface endpoint to this VPC.

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.addInterfaceEndpoint.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmVpcBase.addInterfaceEndpoint.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_ec2.InterfaceVpcEndpointOptions

---

##### `addVpnConnection` <a name="addVpnConnection" id="tm-cdk-constructs.TmVpcBase.addVpnConnection"></a>

```typescript
public addVpnConnection(id: string, options: VpnConnectionOptions): VpnConnection
```

Adds a new VPN connection to this VPC.

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.addVpnConnection.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmVpcBase.addVpnConnection.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_ec2.VpnConnectionOptions

---

##### `enableVpnGateway` <a name="enableVpnGateway" id="tm-cdk-constructs.TmVpcBase.enableVpnGateway"></a>

```typescript
public enableVpnGateway(options: EnableVpnGatewayOptions): void
```

Adds a VPN Gateway to this VPC.

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmVpcBase.enableVpnGateway.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_ec2.EnableVpnGatewayOptions

---

##### `selectSubnets` <a name="selectSubnets" id="tm-cdk-constructs.TmVpcBase.selectSubnets"></a>

```typescript
public selectSubnets(selection?: SubnetSelection): SelectedSubnets
```

Returns IDs of selected subnets.

###### `selection`<sup>Optional</sup> <a name="selection" id="tm-cdk-constructs.TmVpcBase.selectSubnets.parameter.selection"></a>

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#tm-cdk-constructs.TmVpcBase.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.isResource">isResource</a></code> | Check whether the given construct is a Resource. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.fromLookup">fromLookup</a></code> | Import an existing VPC by querying the AWS environment this stack is deployed to. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.fromVpcAttributes">fromVpcAttributes</a></code> | Import a VPC by supplying all attributes directly. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="tm-cdk-constructs.TmVpcBase.isConstruct"></a>

```typescript
import { TmVpcBase } from 'tm-cdk-constructs'

TmVpcBase.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="tm-cdk-constructs.TmVpcBase.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="tm-cdk-constructs.TmVpcBase.isOwnedResource"></a>

```typescript
import { TmVpcBase } from 'tm-cdk-constructs'

TmVpcBase.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="tm-cdk-constructs.TmVpcBase.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="tm-cdk-constructs.TmVpcBase.isResource"></a>

```typescript
import { TmVpcBase } from 'tm-cdk-constructs'

TmVpcBase.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="tm-cdk-constructs.TmVpcBase.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `fromLookup` <a name="fromLookup" id="tm-cdk-constructs.TmVpcBase.fromLookup"></a>

```typescript
import { TmVpcBase } from 'tm-cdk-constructs'

TmVpcBase.fromLookup(scope: Construct, id: string, options: VpcLookupOptions)
```

Import an existing VPC by querying the AWS environment this stack is deployed to.

This function only needs to be used to use VPCs not defined in your CDK
application. If you are looking to share a VPC between stacks, you can
pass the `Vpc` object between stacks and use it as normal.

Calling this method will lead to a lookup when the CDK CLI is executed.
You can therefore not use any values that will only be available at
CloudFormation execution time (i.e., Tokens).

The VPC information will be cached in `cdk.context.json` and the same VPC
will be used on future runs. To refresh the lookup, you will have to
evict the value from the cache using the `cdk context` command. See
https://docs.aws.amazon.com/cdk/latest/guide/context.html for more information.

###### `scope`<sup>Required</sup> <a name="scope" id="tm-cdk-constructs.TmVpcBase.fromLookup.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.fromLookup.parameter.id"></a>

- *Type:* string

---

###### `options`<sup>Required</sup> <a name="options" id="tm-cdk-constructs.TmVpcBase.fromLookup.parameter.options"></a>

- *Type:* aws-cdk-lib.aws_ec2.VpcLookupOptions

---

##### `fromVpcAttributes` <a name="fromVpcAttributes" id="tm-cdk-constructs.TmVpcBase.fromVpcAttributes"></a>

```typescript
import { TmVpcBase } from 'tm-cdk-constructs'

TmVpcBase.fromVpcAttributes(scope: Construct, id: string, attrs: VpcAttributes)
```

Import a VPC by supplying all attributes directly.

NOTE: using `fromVpcAttributes()` with deploy-time parameters (like a `Fn.importValue()` or
`CfnParameter` to represent a list of subnet IDs) sometimes accidentally works. It happens
to work for constructs that need a list of subnets (like `AutoScalingGroup` and `eks.Cluster`)
but it does not work for constructs that need individual subnets (like
`Instance`). See https://github.com/aws/aws-cdk/issues/4118 for more
information.

Prefer to use `Vpc.fromLookup()` instead.

###### `scope`<sup>Required</sup> <a name="scope" id="tm-cdk-constructs.TmVpcBase.fromVpcAttributes.parameter.scope"></a>

- *Type:* constructs.Construct

---

###### `id`<sup>Required</sup> <a name="id" id="tm-cdk-constructs.TmVpcBase.fromVpcAttributes.parameter.id"></a>

- *Type:* string

---

###### `attrs`<sup>Required</sup> <a name="attrs" id="tm-cdk-constructs.TmVpcBase.fromVpcAttributes.parameter.attrs"></a>

- *Type:* aws-cdk-lib.aws_ec2.VpcAttributes

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.availabilityZones">availabilityZones</a></code> | <code>string[]</code> | AZs for this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.dnsHostnamesEnabled">dnsHostnamesEnabled</a></code> | <code>boolean</code> | Indicates if instances launched in this VPC will have public DNS hostnames. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.dnsSupportEnabled">dnsSupportEnabled</a></code> | <code>boolean</code> | Indicates if DNS support is enabled for this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.internetConnectivityEstablished">internetConnectivityEstablished</a></code> | <code>constructs.IDependable</code> | Dependencies for internet connectivity. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.isolatedSubnets">isolatedSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.ISubnet[]</code> | List of isolated subnets in this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.privateSubnets">privateSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.ISubnet[]</code> | List of private subnets in this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.publicSubnets">publicSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.ISubnet[]</code> | List of public subnets in this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpcArn">vpcArn</a></code> | <code>string</code> | Arn of this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpcCidrBlock">vpcCidrBlock</a></code> | <code>string</code> | CIDR range for this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpcCidrBlockAssociations">vpcCidrBlockAssociations</a></code> | <code>string[]</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpcDefaultNetworkAcl">vpcDefaultNetworkAcl</a></code> | <code>string</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpcDefaultSecurityGroup">vpcDefaultSecurityGroup</a></code> | <code>string</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpcId">vpcId</a></code> | <code>string</code> | Identifier for this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpcIpv6CidrBlocks">vpcIpv6CidrBlocks</a></code> | <code>string[]</code> | *No description.* |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.internetGatewayId">internetGatewayId</a></code> | <code>string</code> | Internet Gateway for the VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.vpnGatewayId">vpnGatewayId</a></code> | <code>string</code> | Returns the id of the VPN Gateway (if enabled). |

---

##### `node`<sup>Required</sup> <a name="node" id="tm-cdk-constructs.TmVpcBase.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="tm-cdk-constructs.TmVpcBase.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="tm-cdk-constructs.TmVpcBase.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `availabilityZones`<sup>Required</sup> <a name="availabilityZones" id="tm-cdk-constructs.TmVpcBase.property.availabilityZones"></a>

```typescript
public readonly availabilityZones: string[];
```

- *Type:* string[]

AZs for this VPC.

---

##### `dnsHostnamesEnabled`<sup>Required</sup> <a name="dnsHostnamesEnabled" id="tm-cdk-constructs.TmVpcBase.property.dnsHostnamesEnabled"></a>

```typescript
public readonly dnsHostnamesEnabled: boolean;
```

- *Type:* boolean

Indicates if instances launched in this VPC will have public DNS hostnames.

---

##### `dnsSupportEnabled`<sup>Required</sup> <a name="dnsSupportEnabled" id="tm-cdk-constructs.TmVpcBase.property.dnsSupportEnabled"></a>

```typescript
public readonly dnsSupportEnabled: boolean;
```

- *Type:* boolean

Indicates if DNS support is enabled for this VPC.

---

##### `internetConnectivityEstablished`<sup>Required</sup> <a name="internetConnectivityEstablished" id="tm-cdk-constructs.TmVpcBase.property.internetConnectivityEstablished"></a>

```typescript
public readonly internetConnectivityEstablished: IDependable;
```

- *Type:* constructs.IDependable

Dependencies for internet connectivity.

---

##### `isolatedSubnets`<sup>Required</sup> <a name="isolatedSubnets" id="tm-cdk-constructs.TmVpcBase.property.isolatedSubnets"></a>

```typescript
public readonly isolatedSubnets: ISubnet[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISubnet[]

List of isolated subnets in this VPC.

---

##### `privateSubnets`<sup>Required</sup> <a name="privateSubnets" id="tm-cdk-constructs.TmVpcBase.property.privateSubnets"></a>

```typescript
public readonly privateSubnets: ISubnet[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISubnet[]

List of private subnets in this VPC.

---

##### `publicSubnets`<sup>Required</sup> <a name="publicSubnets" id="tm-cdk-constructs.TmVpcBase.property.publicSubnets"></a>

```typescript
public readonly publicSubnets: ISubnet[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISubnet[]

List of public subnets in this VPC.

---

##### `vpcArn`<sup>Required</sup> <a name="vpcArn" id="tm-cdk-constructs.TmVpcBase.property.vpcArn"></a>

```typescript
public readonly vpcArn: string;
```

- *Type:* string

Arn of this VPC.

---

##### `vpcCidrBlock`<sup>Required</sup> <a name="vpcCidrBlock" id="tm-cdk-constructs.TmVpcBase.property.vpcCidrBlock"></a>

```typescript
public readonly vpcCidrBlock: string;
```

- *Type:* string

CIDR range for this VPC.

---

##### `vpcCidrBlockAssociations`<sup>Required</sup> <a name="vpcCidrBlockAssociations" id="tm-cdk-constructs.TmVpcBase.property.vpcCidrBlockAssociations"></a>

```typescript
public readonly vpcCidrBlockAssociations: string[];
```

- *Type:* string[]

---

##### `vpcDefaultNetworkAcl`<sup>Required</sup> <a name="vpcDefaultNetworkAcl" id="tm-cdk-constructs.TmVpcBase.property.vpcDefaultNetworkAcl"></a>

```typescript
public readonly vpcDefaultNetworkAcl: string;
```

- *Type:* string

---

##### `vpcDefaultSecurityGroup`<sup>Required</sup> <a name="vpcDefaultSecurityGroup" id="tm-cdk-constructs.TmVpcBase.property.vpcDefaultSecurityGroup"></a>

```typescript
public readonly vpcDefaultSecurityGroup: string;
```

- *Type:* string

---

##### `vpcId`<sup>Required</sup> <a name="vpcId" id="tm-cdk-constructs.TmVpcBase.property.vpcId"></a>

```typescript
public readonly vpcId: string;
```

- *Type:* string

Identifier for this VPC.

---

##### `vpcIpv6CidrBlocks`<sup>Required</sup> <a name="vpcIpv6CidrBlocks" id="tm-cdk-constructs.TmVpcBase.property.vpcIpv6CidrBlocks"></a>

```typescript
public readonly vpcIpv6CidrBlocks: string[];
```

- *Type:* string[]

---

##### `internetGatewayId`<sup>Optional</sup> <a name="internetGatewayId" id="tm-cdk-constructs.TmVpcBase.property.internetGatewayId"></a>

```typescript
public readonly internetGatewayId: string;
```

- *Type:* string

Internet Gateway for the VPC.

Note that in case the VPC is configured only
with ISOLATED subnets, this attribute will be `undefined`.

---

##### `vpnGatewayId`<sup>Optional</sup> <a name="vpnGatewayId" id="tm-cdk-constructs.TmVpcBase.property.vpnGatewayId"></a>

```typescript
public readonly vpnGatewayId: string;
```

- *Type:* string

Returns the id of the VPN Gateway (if enabled).

---

#### Constants <a name="Constants" id="Constants"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.DEFAULT_CIDR_RANGE">DEFAULT_CIDR_RANGE</a></code> | <code>string</code> | The default CIDR range used when creating VPCs. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.DEFAULT_SUBNETS">DEFAULT_SUBNETS</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetConfiguration[]</code> | The default subnet configuration. |
| <code><a href="#tm-cdk-constructs.TmVpcBase.property.DEFAULT_SUBNETS_NO_NAT">DEFAULT_SUBNETS_NO_NAT</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetConfiguration[]</code> | The default subnet configuration if natGateways specified to be 0. |

---

##### `DEFAULT_CIDR_RANGE`<sup>Required</sup> <a name="DEFAULT_CIDR_RANGE" id="tm-cdk-constructs.TmVpcBase.property.DEFAULT_CIDR_RANGE"></a>

```typescript
public readonly DEFAULT_CIDR_RANGE: string;
```

- *Type:* string

The default CIDR range used when creating VPCs.

This can be overridden using VpcProps when creating a VPCNetwork resource.
e.g. new VpcResource(this, { cidr: '192.168.0.0./16' })

Note this is specific to the IPv4 CIDR.

---

##### `DEFAULT_SUBNETS`<sup>Required</sup> <a name="DEFAULT_SUBNETS" id="tm-cdk-constructs.TmVpcBase.property.DEFAULT_SUBNETS"></a>

```typescript
public readonly DEFAULT_SUBNETS: SubnetConfiguration[];
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetConfiguration[]

The default subnet configuration.

1 Public and 1 Private subnet per AZ evenly split

---

##### `DEFAULT_SUBNETS_NO_NAT`<sup>Required</sup> <a name="DEFAULT_SUBNETS_NO_NAT" id="tm-cdk-constructs.TmVpcBase.property.DEFAULT_SUBNETS_NO_NAT"></a>

```typescript
public readonly DEFAULT_SUBNETS_NO_NAT: SubnetConfiguration[];
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetConfiguration[]

The default subnet configuration if natGateways specified to be 0.

1 Public and 1 Isolated Subnet per AZ evenly split

---

## Structs <a name="Structs" id="Structs"></a>

### TmPipelineProps <a name="TmPipelineProps" id="tm-cdk-constructs.TmPipelineProps"></a>

#### Initializer <a name="Initializer" id="tm-cdk-constructs.TmPipelineProps.Initializer"></a>

```typescript
import { TmPipelineProps } from 'tm-cdk-constructs'

const tmPipelineProps: TmPipelineProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmPipelineProps.property.pipelineName">pipelineName</a></code> | <code>string</code> | The name of the pipeline. |
| <code><a href="#tm-cdk-constructs.TmPipelineProps.property.repoBranch">repoBranch</a></code> | <code>string</code> | The branch of the repository to use. |
| <code><a href="#tm-cdk-constructs.TmPipelineProps.property.repoName">repoName</a></code> | <code>string</code> | The name of the repository. |
| <code><a href="#tm-cdk-constructs.TmPipelineProps.property.primaryOutputDirectory">primaryOutputDirectory</a></code> | <code>string</code> | The primary output directory. |
| <code><a href="#tm-cdk-constructs.TmPipelineProps.property.synthCommand">synthCommand</a></code> | <code>string[]</code> | The command to run in the synth step. |

---

##### `pipelineName`<sup>Required</sup> <a name="pipelineName" id="tm-cdk-constructs.TmPipelineProps.property.pipelineName"></a>

```typescript
public readonly pipelineName: string;
```

- *Type:* string

The name of the pipeline.

---

##### `repoBranch`<sup>Required</sup> <a name="repoBranch" id="tm-cdk-constructs.TmPipelineProps.property.repoBranch"></a>

```typescript
public readonly repoBranch: string;
```

- *Type:* string

The branch of the repository to use.

---

##### `repoName`<sup>Required</sup> <a name="repoName" id="tm-cdk-constructs.TmPipelineProps.property.repoName"></a>

```typescript
public readonly repoName: string;
```

- *Type:* string

The name of the repository.

---

##### `primaryOutputDirectory`<sup>Optional</sup> <a name="primaryOutputDirectory" id="tm-cdk-constructs.TmPipelineProps.property.primaryOutputDirectory"></a>

```typescript
public readonly primaryOutputDirectory: string;
```

- *Type:* string

The primary output directory.

---

##### `synthCommand`<sup>Optional</sup> <a name="synthCommand" id="tm-cdk-constructs.TmPipelineProps.property.synthCommand"></a>

```typescript
public readonly synthCommand: string[];
```

- *Type:* string[]

The command to run in the synth step.

---

### TmRdsAuroraMysqlServerlessProps <a name="TmRdsAuroraMysqlServerlessProps" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps"></a>

#### Initializer <a name="Initializer" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.Initializer"></a>

```typescript
import { TmRdsAuroraMysqlServerlessProps } from 'tm-cdk-constructs'

const tmRdsAuroraMysqlServerlessProps: TmRdsAuroraMysqlServerlessProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.engine">engine</a></code> | <code>aws-cdk-lib.aws_rds.IClusterEngine</code> | What kind of database to start. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.backtrackWindow">backtrackWindow</a></code> | <code>aws-cdk-lib.Duration</code> | The number of seconds to set a cluster's target backtrack window to. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.backup">backup</a></code> | <code>aws-cdk-lib.aws_rds.BackupProps</code> | Backup settings. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.cloudwatchLogsExports">cloudwatchLogsExports</a></code> | <code>string[]</code> | The list of log types that need to be enabled for exporting to CloudWatch Logs. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.cloudwatchLogsRetention">cloudwatchLogsRetention</a></code> | <code>aws-cdk-lib.aws_logs.RetentionDays</code> | The number of days log events are kept in CloudWatch Logs. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.cloudwatchLogsRetentionRole">cloudwatchLogsRetentionRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | The IAM role for the Lambda function associated with the custom resource that sets the retention policy. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.clusterIdentifier">clusterIdentifier</a></code> | <code>string</code> | An optional identifier for the cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.copyTagsToSnapshot">copyTagsToSnapshot</a></code> | <code>boolean</code> | Whether to copy tags to the snapshot when a snapshot is created. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.credentials">credentials</a></code> | <code>aws-cdk-lib.aws_rds.Credentials</code> | Credentials for the administrative user. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.defaultDatabaseName">defaultDatabaseName</a></code> | <code>string</code> | Name of a database which is automatically created inside the cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.deletionProtection">deletionProtection</a></code> | <code>boolean</code> | Indicates whether the DB cluster should have deletion protection enabled. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.domain">domain</a></code> | <code>string</code> | Directory ID for associating the DB cluster with a specific Active Directory. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.domainRole">domainRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | The IAM role to be used when making API calls to the Directory Service. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.enableDataApi">enableDataApi</a></code> | <code>boolean</code> | Whether to enable the Data API for the cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.iamAuthentication">iamAuthentication</a></code> | <code>boolean</code> | Whether to enable mapping of AWS Identity and Access Management (IAM) accounts to database accounts. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instanceIdentifierBase">instanceIdentifierBase</a></code> | <code>string</code> | Base identifier for instances. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instanceProps">instanceProps</a></code> | <code>aws-cdk-lib.aws_rds.InstanceProps</code> | Settings for the individual instances that are launched. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instances">instances</a></code> | <code>number</code> | How many replicas/instances to create. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instanceUpdateBehaviour">instanceUpdateBehaviour</a></code> | <code>aws-cdk-lib.aws_rds.InstanceUpdateBehaviour</code> | The ordering of updates for instances. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.monitoringInterval">monitoringInterval</a></code> | <code>aws-cdk-lib.Duration</code> | The interval, in seconds, between points when Amazon RDS collects enhanced monitoring metrics for the DB instances. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.monitoringRole">monitoringRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | Role that will be used to manage DB instances monitoring. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.networkType">networkType</a></code> | <code>aws-cdk-lib.aws_rds.NetworkType</code> | The network type of the DB instance. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.parameterGroup">parameterGroup</a></code> | <code>aws-cdk-lib.aws_rds.IParameterGroup</code> | Additional parameters to pass to the database engine. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.parameters">parameters</a></code> | <code>{[ key: string ]: string}</code> | The parameters in the DBClusterParameterGroup to create automatically. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.port">port</a></code> | <code>number</code> | What port to listen on. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.preferredMaintenanceWindow">preferredMaintenanceWindow</a></code> | <code>string</code> | A preferred maintenance window day/time range. Should be specified as a range ddd:hh24:mi-ddd:hh24:mi (24H Clock UTC). |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.readers">readers</a></code> | <code>aws-cdk-lib.aws_rds.IClusterInstance[]</code> | A list of instances to create as cluster reader instances. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.removalPolicy">removalPolicy</a></code> | <code>aws-cdk-lib.RemovalPolicy</code> | The removal policy to apply when the cluster and its instances are removed from the stack or replaced during an update. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ExportBuckets">s3ExportBuckets</a></code> | <code>aws-cdk-lib.aws_s3.IBucket[]</code> | S3 buckets that you want to load data into. This feature is only supported by the Aurora database engine. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ExportRole">s3ExportRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | Role that will be associated with this DB cluster to enable S3 export. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ImportBuckets">s3ImportBuckets</a></code> | <code>aws-cdk-lib.aws_s3.IBucket[]</code> | S3 buckets that you want to load data from. This feature is only supported by the Aurora database engine. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ImportRole">s3ImportRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | Role that will be associated with this DB cluster to enable S3 import. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.securityGroups">securityGroups</a></code> | <code>aws-cdk-lib.aws_ec2.ISecurityGroup[]</code> | Security group. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.serverlessV2MaxCapacity">serverlessV2MaxCapacity</a></code> | <code>number</code> | The maximum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.serverlessV2MinCapacity">serverlessV2MinCapacity</a></code> | <code>number</code> | The minimum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.storageEncrypted">storageEncrypted</a></code> | <code>boolean</code> | Whether to enable storage encryption. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.storageEncryptionKey">storageEncryptionKey</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | The KMS key for storage encryption. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.storageType">storageType</a></code> | <code>aws-cdk-lib.aws_rds.DBClusterStorageType</code> | The storage type to be associated with the DB cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.subnetGroup">subnetGroup</a></code> | <code>aws-cdk-lib.aws_rds.ISubnetGroup</code> | Existing subnet group for the cluster. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | What subnets to run the RDS instances in. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Where to place the instances within the VPC. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.writer">writer</a></code> | <code>aws-cdk-lib.aws_rds.IClusterInstance</code> | The instance to use for the cluster writer. |
| <code><a href="#tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.enableGlobal">enableGlobal</a></code> | <code>boolean</code> | Enable the creation of a Global Cluster for the RDS cluster. |

---

##### `engine`<sup>Required</sup> <a name="engine" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.engine"></a>

```typescript
public readonly engine: IClusterEngine;
```

- *Type:* aws-cdk-lib.aws_rds.IClusterEngine

What kind of database to start.

---

##### `backtrackWindow`<sup>Optional</sup> <a name="backtrackWindow" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.backtrackWindow"></a>

```typescript
public readonly backtrackWindow: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* 0 seconds (no backtrack)

The number of seconds to set a cluster's target backtrack window to.

This feature is only supported by the Aurora MySQL database engine and
cannot be enabled on existing clusters.

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Managing.Backtrack.html](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.Managing.Backtrack.html)

---

##### `backup`<sup>Optional</sup> <a name="backup" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.backup"></a>

```typescript
public readonly backup: BackupProps;
```

- *Type:* aws-cdk-lib.aws_rds.BackupProps
- *Default:* Backup retention period for automated backups is 1 day. Backup preferred window is set to a 30-minute window selected at random from an 8-hour block of time for each AWS Region, occurring on a random day of the week.

Backup settings.

> [https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html#USER_WorkingWithAutomatedBackups.BackupWindow](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html#USER_WorkingWithAutomatedBackups.BackupWindow)

---

##### `cloudwatchLogsExports`<sup>Optional</sup> <a name="cloudwatchLogsExports" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.cloudwatchLogsExports"></a>

```typescript
public readonly cloudwatchLogsExports: string[];
```

- *Type:* string[]
- *Default:* no log exports

The list of log types that need to be enabled for exporting to CloudWatch Logs.

---

##### `cloudwatchLogsRetention`<sup>Optional</sup> <a name="cloudwatchLogsRetention" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.cloudwatchLogsRetention"></a>

```typescript
public readonly cloudwatchLogsRetention: RetentionDays;
```

- *Type:* aws-cdk-lib.aws_logs.RetentionDays
- *Default:* logs never expire

The number of days log events are kept in CloudWatch Logs.

When updating
this property, unsetting it doesn't remove the log retention policy. To
remove the retention policy, set the value to `Infinity`.

---

##### `cloudwatchLogsRetentionRole`<sup>Optional</sup> <a name="cloudwatchLogsRetentionRole" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.cloudwatchLogsRetentionRole"></a>

```typescript
public readonly cloudwatchLogsRetentionRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* a new role is created.

The IAM role for the Lambda function associated with the custom resource that sets the retention policy.

---

##### `clusterIdentifier`<sup>Optional</sup> <a name="clusterIdentifier" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.clusterIdentifier"></a>

```typescript
public readonly clusterIdentifier: string;
```

- *Type:* string
- *Default:* A name is automatically generated.

An optional identifier for the cluster.

---

##### `copyTagsToSnapshot`<sup>Optional</sup> <a name="copyTagsToSnapshot" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.copyTagsToSnapshot"></a>

```typescript
public readonly copyTagsToSnapshot: boolean;
```

- *Type:* boolean
- *Default:* true

Whether to copy tags to the snapshot when a snapshot is created.

---

##### `credentials`<sup>Optional</sup> <a name="credentials" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.credentials"></a>

```typescript
public readonly credentials: Credentials;
```

- *Type:* aws-cdk-lib.aws_rds.Credentials
- *Default:* A username of 'admin' (or 'postgres' for PostgreSQL) and SecretsManager-generated password

Credentials for the administrative user.

---

##### `defaultDatabaseName`<sup>Optional</sup> <a name="defaultDatabaseName" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.defaultDatabaseName"></a>

```typescript
public readonly defaultDatabaseName: string;
```

- *Type:* string
- *Default:* Database is not created in cluster.

Name of a database which is automatically created inside the cluster.

---

##### `deletionProtection`<sup>Optional</sup> <a name="deletionProtection" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.deletionProtection"></a>

```typescript
public readonly deletionProtection: boolean;
```

- *Type:* boolean
- *Default:* true if `removalPolicy` is RETAIN, `undefined` otherwise, which will not enable deletion protection. To disable deletion protection after it has been enabled, you must explicitly set this value to `false`.

Indicates whether the DB cluster should have deletion protection enabled.

---

##### `domain`<sup>Optional</sup> <a name="domain" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.domain"></a>

```typescript
public readonly domain: string;
```

- *Type:* string
- *Default:* DB cluster is not associated with an Active Directory; Kerberos authentication is not enabled.

Directory ID for associating the DB cluster with a specific Active Directory.

Necessary for enabling Kerberos authentication. If specified, the DB cluster joins the given Active Directory, enabling Kerberos authentication.
If not specified, the DB cluster will not be associated with any Active Directory, and Kerberos authentication will not be enabled.

---

##### `domainRole`<sup>Optional</sup> <a name="domainRole" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.domainRole"></a>

```typescript
public readonly domainRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* If `DatabaseClusterBaseProps.domain` is specified, a role with the `AmazonRDSDirectoryServiceAccess` policy is automatically created.

The IAM role to be used when making API calls to the Directory Service.

The role needs the AWS-managed policy
`AmazonRDSDirectoryServiceAccess` or equivalent.

---

##### `enableDataApi`<sup>Optional</sup> <a name="enableDataApi" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.enableDataApi"></a>

```typescript
public readonly enableDataApi: boolean;
```

- *Type:* boolean
- *Default:* false

Whether to enable the Data API for the cluster.

---

##### `iamAuthentication`<sup>Optional</sup> <a name="iamAuthentication" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.iamAuthentication"></a>

```typescript
public readonly iamAuthentication: boolean;
```

- *Type:* boolean
- *Default:* false

Whether to enable mapping of AWS Identity and Access Management (IAM) accounts to database accounts.

---

##### `instanceIdentifierBase`<sup>Optional</sup> <a name="instanceIdentifierBase" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instanceIdentifierBase"></a>

```typescript
public readonly instanceIdentifierBase: string;
```

- *Type:* string
- *Default:* clusterIdentifier is used with the word "Instance" appended. If clusterIdentifier is not provided, the identifier is automatically generated.

Base identifier for instances.

Every replica is named by appending the replica number to this string, 1-based.

---

##### ~~`instanceProps`~~<sup>Optional</sup> <a name="instanceProps" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instanceProps"></a>

- *Deprecated:* - use writer and readers instead

```typescript
public readonly instanceProps: InstanceProps;
```

- *Type:* aws-cdk-lib.aws_rds.InstanceProps

Settings for the individual instances that are launched.

---

##### ~~`instances`~~<sup>Optional</sup> <a name="instances" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instances"></a>

- *Deprecated:* - use writer and readers instead

```typescript
public readonly instances: number;
```

- *Type:* number
- *Default:* 2

How many replicas/instances to create.

Has to be at least 1.

---

##### `instanceUpdateBehaviour`<sup>Optional</sup> <a name="instanceUpdateBehaviour" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.instanceUpdateBehaviour"></a>

```typescript
public readonly instanceUpdateBehaviour: InstanceUpdateBehaviour;
```

- *Type:* aws-cdk-lib.aws_rds.InstanceUpdateBehaviour
- *Default:* InstanceUpdateBehaviour.BULK

The ordering of updates for instances.

---

##### `monitoringInterval`<sup>Optional</sup> <a name="monitoringInterval" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.monitoringInterval"></a>

```typescript
public readonly monitoringInterval: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* no enhanced monitoring

The interval, in seconds, between points when Amazon RDS collects enhanced monitoring metrics for the DB instances.

---

##### `monitoringRole`<sup>Optional</sup> <a name="monitoringRole" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.monitoringRole"></a>

```typescript
public readonly monitoringRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* A role is automatically created for you

Role that will be used to manage DB instances monitoring.

---

##### `networkType`<sup>Optional</sup> <a name="networkType" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.networkType"></a>

```typescript
public readonly networkType: NetworkType;
```

- *Type:* aws-cdk-lib.aws_rds.NetworkType
- *Default:* IPV4

The network type of the DB instance.

---

##### `parameterGroup`<sup>Optional</sup> <a name="parameterGroup" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.parameterGroup"></a>

```typescript
public readonly parameterGroup: IParameterGroup;
```

- *Type:* aws-cdk-lib.aws_rds.IParameterGroup
- *Default:* No parameter group.

Additional parameters to pass to the database engine.

---

##### `parameters`<sup>Optional</sup> <a name="parameters" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.parameters"></a>

```typescript
public readonly parameters: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}
- *Default:* None

The parameters in the DBClusterParameterGroup to create automatically.

You can only specify parameterGroup or parameters but not both.
You need to use a versioned engine to auto-generate a DBClusterParameterGroup.

---

##### `port`<sup>Optional</sup> <a name="port" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.port"></a>

```typescript
public readonly port: number;
```

- *Type:* number
- *Default:* The default for the engine is used.

What port to listen on.

---

##### `preferredMaintenanceWindow`<sup>Optional</sup> <a name="preferredMaintenanceWindow" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.preferredMaintenanceWindow"></a>

```typescript
public readonly preferredMaintenanceWindow: string;
```

- *Type:* string
- *Default:* 30-minute window selected at random from an 8-hour block of time for each AWS Region, occurring on a random day of the week.

A preferred maintenance window day/time range. Should be specified as a range ddd:hh24:mi-ddd:hh24:mi (24H Clock UTC).

Example: 'Sun:23:45-Mon:00:15'

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_UpgradeDBInstance.Maintenance.html#Concepts.DBMaintenance](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_UpgradeDBInstance.Maintenance.html#Concepts.DBMaintenance)

---

##### `readers`<sup>Optional</sup> <a name="readers" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.readers"></a>

```typescript
public readonly readers: IClusterInstance[];
```

- *Type:* aws-cdk-lib.aws_rds.IClusterInstance[]
- *Default:* no readers are created. The cluster will have a single writer/reader

A list of instances to create as cluster reader instances.

---

##### `removalPolicy`<sup>Optional</sup> <a name="removalPolicy" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.removalPolicy"></a>

```typescript
public readonly removalPolicy: RemovalPolicy;
```

- *Type:* aws-cdk-lib.RemovalPolicy
- *Default:* RemovalPolicy.SNAPSHOT (remove the cluster and instances, but retain a snapshot of the data)

The removal policy to apply when the cluster and its instances are removed from the stack or replaced during an update.

---

##### `s3ExportBuckets`<sup>Optional</sup> <a name="s3ExportBuckets" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ExportBuckets"></a>

```typescript
public readonly s3ExportBuckets: IBucket[];
```

- *Type:* aws-cdk-lib.aws_s3.IBucket[]
- *Default:* None

S3 buckets that you want to load data into. This feature is only supported by the Aurora database engine.

This property must not be used if `s3ExportRole` is used.

For MySQL:

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/postgresql-s3-export.html](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/postgresql-s3-export.html)

---

##### `s3ExportRole`<sup>Optional</sup> <a name="s3ExportRole" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ExportRole"></a>

```typescript
public readonly s3ExportRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* New role is created if `s3ExportBuckets` is set, no role is defined otherwise

Role that will be associated with this DB cluster to enable S3 export.

This feature is only supported by the Aurora database engine.

This property must not be used if `s3ExportBuckets` is used.

For MySQL:

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/postgresql-s3-export.html](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/postgresql-s3-export.html)

---

##### `s3ImportBuckets`<sup>Optional</sup> <a name="s3ImportBuckets" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ImportBuckets"></a>

```typescript
public readonly s3ImportBuckets: IBucket[];
```

- *Type:* aws-cdk-lib.aws_s3.IBucket[]
- *Default:* None

S3 buckets that you want to load data from. This feature is only supported by the Aurora database engine.

This property must not be used if `s3ImportRole` is used.

For MySQL:

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.html](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.html)

---

##### `s3ImportRole`<sup>Optional</sup> <a name="s3ImportRole" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.s3ImportRole"></a>

```typescript
public readonly s3ImportRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* New role is created if `s3ImportBuckets` is set, no role is defined otherwise

Role that will be associated with this DB cluster to enable S3 import.

This feature is only supported by the Aurora database engine.

This property must not be used if `s3ImportBuckets` is used.

For MySQL:

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.html](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.html)

---

##### `securityGroups`<sup>Optional</sup> <a name="securityGroups" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.securityGroups"></a>

```typescript
public readonly securityGroups: ISecurityGroup[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISecurityGroup[]
- *Default:* a new security group is created.

Security group.

---

##### `serverlessV2MaxCapacity`<sup>Optional</sup> <a name="serverlessV2MaxCapacity" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.serverlessV2MaxCapacity"></a>

```typescript
public readonly serverlessV2MaxCapacity: number;
```

- *Type:* number
- *Default:* 2

The maximum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.

You can specify ACU values in half-step increments, such as 40, 40.5, 41, and so on.
The largest value that you can use is 128 (256GB).

The maximum capacity must be higher than 0.5 ACUs.

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html#aurora-serverless-v2.max_capacity_considerations](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html#aurora-serverless-v2.max_capacity_considerations)

---

##### `serverlessV2MinCapacity`<sup>Optional</sup> <a name="serverlessV2MinCapacity" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.serverlessV2MinCapacity"></a>

```typescript
public readonly serverlessV2MinCapacity: number;
```

- *Type:* number
- *Default:* 0.5

The minimum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.

You can specify ACU values in half-step increments, such as 8, 8.5, 9, and so on.
The smallest value that you can use is 0.5.

> [https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html#aurora-serverless-v2.max_capacity_considerations](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html#aurora-serverless-v2.max_capacity_considerations)

---

##### `storageEncrypted`<sup>Optional</sup> <a name="storageEncrypted" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.storageEncrypted"></a>

```typescript
public readonly storageEncrypted: boolean;
```

- *Type:* boolean
- *Default:* true if storageEncryptionKey is provided, false otherwise

Whether to enable storage encryption.

---

##### `storageEncryptionKey`<sup>Optional</sup> <a name="storageEncryptionKey" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.storageEncryptionKey"></a>

```typescript
public readonly storageEncryptionKey: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey
- *Default:* if storageEncrypted is true then the default master key, no key otherwise

The KMS key for storage encryption.

If specified, `storageEncrypted` will be set to `true`.

---

##### `storageType`<sup>Optional</sup> <a name="storageType" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.storageType"></a>

```typescript
public readonly storageType: DBClusterStorageType;
```

- *Type:* aws-cdk-lib.aws_rds.DBClusterStorageType
- *Default:* DBClusterStorageType.AURORA_IOPT1

The storage type to be associated with the DB cluster.

---

##### `subnetGroup`<sup>Optional</sup> <a name="subnetGroup" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.subnetGroup"></a>

```typescript
public readonly subnetGroup: ISubnetGroup;
```

- *Type:* aws-cdk-lib.aws_rds.ISubnetGroup
- *Default:* a new subnet group will be created.

Existing subnet group for the cluster.

---

##### `vpc`<sup>Optional</sup> <a name="vpc" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

What subnets to run the RDS instances in.

Must be at least 2 subnets in two different AZs.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* the Vpc default strategy if not specified.

Where to place the instances within the VPC.

---

##### `writer`<sup>Optional</sup> <a name="writer" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.writer"></a>

```typescript
public readonly writer: IClusterInstance;
```

- *Type:* aws-cdk-lib.aws_rds.IClusterInstance
- *Default:* required if instanceProps is not provided

The instance to use for the cluster writer.

---

##### `enableGlobal`<sup>Optional</sup> <a name="enableGlobal" id="tm-cdk-constructs.TmRdsAuroraMysqlServerlessProps.property.enableGlobal"></a>

```typescript
public readonly enableGlobal: boolean;
```

- *Type:* boolean

Enable the creation of a Global Cluster for the RDS cluster.

---

### TmVpcProps <a name="TmVpcProps" id="tm-cdk-constructs.TmVpcProps"></a>

Represents the configuration for a VPC.

#### Initializer <a name="Initializer" id="tm-cdk-constructs.TmVpcProps.Initializer"></a>

```typescript
import { TmVpcProps } from 'tm-cdk-constructs'

const tmVpcProps: TmVpcProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.availabilityZones">availabilityZones</a></code> | <code>string[]</code> | Availability zones this VPC spans. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.cidr">cidr</a></code> | <code>string</code> | The CIDR range to use for the VPC, e.g. '10.0.0.0/16'. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.createInternetGateway">createInternetGateway</a></code> | <code>boolean</code> | If set to false then disable the creation of the default internet gateway. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.defaultInstanceTenancy">defaultInstanceTenancy</a></code> | <code>aws-cdk-lib.aws_ec2.DefaultInstanceTenancy</code> | The default tenancy of instances launched into the VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.enableDnsHostnames">enableDnsHostnames</a></code> | <code>boolean</code> | Indicates whether the instances launched in the VPC get public DNS hostnames. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.enableDnsSupport">enableDnsSupport</a></code> | <code>boolean</code> | Indicates whether the DNS resolution is supported for the VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.flowLogs">flowLogs</a></code> | <code>{[ key: string ]: aws-cdk-lib.aws_ec2.FlowLogOptions}</code> | Flow logs to add to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.gatewayEndpoints">gatewayEndpoints</a></code> | <code>{[ key: string ]: aws-cdk-lib.aws_ec2.GatewayVpcEndpointOptions}</code> | Gateway endpoints to add to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.ipAddresses">ipAddresses</a></code> | <code>aws-cdk-lib.aws_ec2.IIpAddresses</code> | The Provider to use to allocate IPv4 Space to your VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.ipProtocol">ipProtocol</a></code> | <code>aws-cdk-lib.aws_ec2.IpProtocol</code> | The protocol of the vpc. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.ipv6Addresses">ipv6Addresses</a></code> | <code>aws-cdk-lib.aws_ec2.IIpv6Addresses</code> | The Provider to use to allocate IPv6 Space to your VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.maxAzs">maxAzs</a></code> | <code>number</code> | Define the maximum number of AZs to use in this region. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.natGatewayProvider">natGatewayProvider</a></code> | <code>aws-cdk-lib.aws_ec2.NatProvider</code> | What type of NAT provider to use. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.natGateways">natGateways</a></code> | <code>number</code> | The number of NAT Gateways/Instances to create. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.natGatewaySubnets">natGatewaySubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Configures the subnets which will have NAT Gateways/Instances. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.reservedAzs">reservedAzs</a></code> | <code>number</code> | Define the number of AZs to reserve. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.restrictDefaultSecurityGroup">restrictDefaultSecurityGroup</a></code> | <code>boolean</code> | If set to true then the default inbound & outbound rules will be removed from the default security group. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.subnetConfiguration">subnetConfiguration</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetConfiguration[]</code> | Configure the subnets to build for each AZ. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.vpcName">vpcName</a></code> | <code>string</code> | The VPC name. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.vpnConnections">vpnConnections</a></code> | <code>{[ key: string ]: aws-cdk-lib.aws_ec2.VpnConnectionOptions}</code> | VPN connections to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.vpnGateway">vpnGateway</a></code> | <code>boolean</code> | Indicates whether a VPN gateway should be created and attached to this VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.vpnGatewayAsn">vpnGatewayAsn</a></code> | <code>number</code> | The private Autonomous System Number (ASN) for the VPN gateway. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.vpnRoutePropagation">vpnRoutePropagation</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection[]</code> | Where to propagate VPN routes. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.rangeCidr">rangeCidr</a></code> | <code>string</code> | The CIDR block for the VPC. |
| <code><a href="#tm-cdk-constructs.TmVpcProps.property.enableEndpoints">enableEndpoints</a></code> | <code>string[]</code> | Indicates whether to enable the S3 endpoint for the VPC. |

---

##### `availabilityZones`<sup>Optional</sup> <a name="availabilityZones" id="tm-cdk-constructs.TmVpcProps.property.availabilityZones"></a>

```typescript
public readonly availabilityZones: string[];
```

- *Type:* string[]
- *Default:* a subset of AZs of the stack

Availability zones this VPC spans.

Specify this option only if you do not specify `maxAzs`.

---

##### ~~`cidr`~~<sup>Optional</sup> <a name="cidr" id="tm-cdk-constructs.TmVpcProps.property.cidr"></a>

- *Deprecated:* Use ipAddresses instead

```typescript
public readonly cidr: string;
```

- *Type:* string
- *Default:* Vpc.DEFAULT_CIDR_RANGE

The CIDR range to use for the VPC, e.g. '10.0.0.0/16'.

Should be a minimum of /28 and maximum size of /16. The range will be
split across all subnets per Availability Zone.

---

##### `createInternetGateway`<sup>Optional</sup> <a name="createInternetGateway" id="tm-cdk-constructs.TmVpcProps.property.createInternetGateway"></a>

```typescript
public readonly createInternetGateway: boolean;
```

- *Type:* boolean
- *Default:* true

If set to false then disable the creation of the default internet gateway.

---

##### `defaultInstanceTenancy`<sup>Optional</sup> <a name="defaultInstanceTenancy" id="tm-cdk-constructs.TmVpcProps.property.defaultInstanceTenancy"></a>

```typescript
public readonly defaultInstanceTenancy: DefaultInstanceTenancy;
```

- *Type:* aws-cdk-lib.aws_ec2.DefaultInstanceTenancy
- *Default:* DefaultInstanceTenancy.Default (shared) tenancy

The default tenancy of instances launched into the VPC.

By setting this to dedicated tenancy, instances will be launched on
hardware dedicated to a single AWS customer, unless specifically specified
at instance launch time. Please note, not all instance types are usable
with Dedicated tenancy.

---

##### `enableDnsHostnames`<sup>Optional</sup> <a name="enableDnsHostnames" id="tm-cdk-constructs.TmVpcProps.property.enableDnsHostnames"></a>

```typescript
public readonly enableDnsHostnames: boolean;
```

- *Type:* boolean
- *Default:* true

Indicates whether the instances launched in the VPC get public DNS hostnames.

If this attribute is true, instances in the VPC get public DNS hostnames,
but only if the enableDnsSupport attribute is also set to true.

---

##### `enableDnsSupport`<sup>Optional</sup> <a name="enableDnsSupport" id="tm-cdk-constructs.TmVpcProps.property.enableDnsSupport"></a>

```typescript
public readonly enableDnsSupport: boolean;
```

- *Type:* boolean
- *Default:* true

Indicates whether the DNS resolution is supported for the VPC.

If this attribute is false, the Amazon-provided DNS server in the VPC that
resolves public DNS hostnames to IP addresses is not enabled. If this
attribute is true, queries to the Amazon provided DNS server at the
169.254.169.253 IP address, or the reserved IP address at the base of the
VPC IPv4 network range plus two will succeed.

---

##### `flowLogs`<sup>Optional</sup> <a name="flowLogs" id="tm-cdk-constructs.TmVpcProps.property.flowLogs"></a>

```typescript
public readonly flowLogs: {[ key: string ]: FlowLogOptions};
```

- *Type:* {[ key: string ]: aws-cdk-lib.aws_ec2.FlowLogOptions}
- *Default:* No flow logs.

Flow logs to add to this VPC.

---

##### `gatewayEndpoints`<sup>Optional</sup> <a name="gatewayEndpoints" id="tm-cdk-constructs.TmVpcProps.property.gatewayEndpoints"></a>

```typescript
public readonly gatewayEndpoints: {[ key: string ]: GatewayVpcEndpointOptions};
```

- *Type:* {[ key: string ]: aws-cdk-lib.aws_ec2.GatewayVpcEndpointOptions}
- *Default:* None.

Gateway endpoints to add to this VPC.

---

##### `ipAddresses`<sup>Optional</sup> <a name="ipAddresses" id="tm-cdk-constructs.TmVpcProps.property.ipAddresses"></a>

```typescript
public readonly ipAddresses: IIpAddresses;
```

- *Type:* aws-cdk-lib.aws_ec2.IIpAddresses
- *Default:* ec2.IpAddresses.cidr

The Provider to use to allocate IPv4 Space to your VPC.

Options include static allocation or from a pool.

Note this is specific to IPv4 addresses.

---

##### `ipProtocol`<sup>Optional</sup> <a name="ipProtocol" id="tm-cdk-constructs.TmVpcProps.property.ipProtocol"></a>

```typescript
public readonly ipProtocol: IpProtocol;
```

- *Type:* aws-cdk-lib.aws_ec2.IpProtocol
- *Default:* IpProtocol.IPV4_ONLY

The protocol of the vpc.

Options are IPv4 only or dual stack.

---

##### `ipv6Addresses`<sup>Optional</sup> <a name="ipv6Addresses" id="tm-cdk-constructs.TmVpcProps.property.ipv6Addresses"></a>

```typescript
public readonly ipv6Addresses: IIpv6Addresses;
```

- *Type:* aws-cdk-lib.aws_ec2.IIpv6Addresses
- *Default:* Ipv6Addresses.amazonProvided

The Provider to use to allocate IPv6 Space to your VPC.

Options include amazon provided CIDR block.

Note this is specific to IPv6 addresses.

---

##### `maxAzs`<sup>Optional</sup> <a name="maxAzs" id="tm-cdk-constructs.TmVpcProps.property.maxAzs"></a>

```typescript
public readonly maxAzs: number;
```

- *Type:* number
- *Default:* 3

Define the maximum number of AZs to use in this region.

If the region has more AZs than you want to use (for example, because of
EIP limits), pick a lower number here. The AZs will be sorted and picked
from the start of the list.

If you pick a higher number than the number of AZs in the region, all AZs
in the region will be selected. To use "all AZs" available to your
account, use a high number (such as 99).

Be aware that environment-agnostic stacks will be created with access to
only 2 AZs, so to use more than 2 AZs, be sure to specify the account and
region on your stack.

Specify this option only if you do not specify `availabilityZones`.

---

##### `natGatewayProvider`<sup>Optional</sup> <a name="natGatewayProvider" id="tm-cdk-constructs.TmVpcProps.property.natGatewayProvider"></a>

```typescript
public readonly natGatewayProvider: NatProvider;
```

- *Type:* aws-cdk-lib.aws_ec2.NatProvider
- *Default:* NatProvider.gateway()

What type of NAT provider to use.

Select between NAT gateways or NAT instances. NAT gateways
may not be available in all AWS regions.

---

##### `natGateways`<sup>Optional</sup> <a name="natGateways" id="tm-cdk-constructs.TmVpcProps.property.natGateways"></a>

```typescript
public readonly natGateways: number;
```

- *Type:* number
- *Default:* One NAT gateway/instance per Availability Zone

The number of NAT Gateways/Instances to create.

The type of NAT gateway or instance will be determined by the
`natGatewayProvider` parameter.

You can set this number lower than the number of Availability Zones in your
VPC in order to save on NAT cost. Be aware you may be charged for
cross-AZ data traffic instead.

---

##### `natGatewaySubnets`<sup>Optional</sup> <a name="natGatewaySubnets" id="tm-cdk-constructs.TmVpcProps.property.natGatewaySubnets"></a>

```typescript
public readonly natGatewaySubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* All public subnets.

Configures the subnets which will have NAT Gateways/Instances.

You can pick a specific group of subnets by specifying the group name;
the picked subnets must be public subnets.

Only necessary if you have more than one public subnet group.

---

##### `reservedAzs`<sup>Optional</sup> <a name="reservedAzs" id="tm-cdk-constructs.TmVpcProps.property.reservedAzs"></a>

```typescript
public readonly reservedAzs: number;
```

- *Type:* number
- *Default:* 0

Define the number of AZs to reserve.

When specified, the IP space is reserved for the azs but no actual
resources are provisioned.

---

##### `restrictDefaultSecurityGroup`<sup>Optional</sup> <a name="restrictDefaultSecurityGroup" id="tm-cdk-constructs.TmVpcProps.property.restrictDefaultSecurityGroup"></a>

```typescript
public readonly restrictDefaultSecurityGroup: boolean;
```

- *Type:* boolean
- *Default:* true if '@aws-cdk/aws-ec2:restrictDefaultSecurityGroup' is enabled, false otherwise

If set to true then the default inbound & outbound rules will be removed from the default security group.

---

##### `subnetConfiguration`<sup>Optional</sup> <a name="subnetConfiguration" id="tm-cdk-constructs.TmVpcProps.property.subnetConfiguration"></a>

```typescript
public readonly subnetConfiguration: SubnetConfiguration[];
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetConfiguration[]
- *Default:* The VPC CIDR will be evenly divided between 1 public and 1 private subnet per AZ.

Configure the subnets to build for each AZ.

Each entry in this list configures a Subnet Group; each group will contain a
subnet for each Availability Zone.

For example, if you want 1 public subnet, 1 private subnet, and 1 isolated
subnet in each AZ provide the following:

```ts
new ec2.Vpc(this, 'VPC', {
  subnetConfiguration: [
     {
       cidrMask: 24,
       name: 'ingress',
       subnetType: ec2.SubnetType.PUBLIC,
     },
     {
       cidrMask: 24,
       name: 'application',
       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
     },
     {
       cidrMask: 28,
       name: 'rds',
       subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
     }
  ]
});
```

---

##### `vpcName`<sup>Optional</sup> <a name="vpcName" id="tm-cdk-constructs.TmVpcProps.property.vpcName"></a>

```typescript
public readonly vpcName: string;
```

- *Type:* string
- *Default:* this.node.path

The VPC name.

Since the VPC resource doesn't support providing a physical name, the value provided here will be recorded in the `Name` tag

---

##### `vpnConnections`<sup>Optional</sup> <a name="vpnConnections" id="tm-cdk-constructs.TmVpcProps.property.vpnConnections"></a>

```typescript
public readonly vpnConnections: {[ key: string ]: VpnConnectionOptions};
```

- *Type:* {[ key: string ]: aws-cdk-lib.aws_ec2.VpnConnectionOptions}
- *Default:* No connections.

VPN connections to this VPC.

---

##### `vpnGateway`<sup>Optional</sup> <a name="vpnGateway" id="tm-cdk-constructs.TmVpcProps.property.vpnGateway"></a>

```typescript
public readonly vpnGateway: boolean;
```

- *Type:* boolean
- *Default:* true when vpnGatewayAsn or vpnConnections is specified

Indicates whether a VPN gateway should be created and attached to this VPC.

---

##### `vpnGatewayAsn`<sup>Optional</sup> <a name="vpnGatewayAsn" id="tm-cdk-constructs.TmVpcProps.property.vpnGatewayAsn"></a>

```typescript
public readonly vpnGatewayAsn: number;
```

- *Type:* number
- *Default:* Amazon default ASN.

The private Autonomous System Number (ASN) for the VPN gateway.

---

##### `vpnRoutePropagation`<sup>Optional</sup> <a name="vpnRoutePropagation" id="tm-cdk-constructs.TmVpcProps.property.vpnRoutePropagation"></a>

```typescript
public readonly vpnRoutePropagation: SubnetSelection[];
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection[]
- *Default:* On the route tables associated with private subnets. If no private subnets exists, isolated subnets are used. If no isolated subnets exists, public subnets are used.

Where to propagate VPN routes.

---

##### `rangeCidr`<sup>Required</sup> <a name="rangeCidr" id="tm-cdk-constructs.TmVpcProps.property.rangeCidr"></a>

```typescript
public readonly rangeCidr: string;
```

- *Type:* string

The CIDR block for the VPC.

---

##### `enableEndpoints`<sup>Optional</sup> <a name="enableEndpoints" id="tm-cdk-constructs.TmVpcProps.property.enableEndpoints"></a>

```typescript
public readonly enableEndpoints: string[];
```

- *Type:* string[]

Indicates whether to enable the S3 endpoint for the VPC.

---



