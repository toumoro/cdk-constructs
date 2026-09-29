# Auto-scaling override — `TmApplicationLoadBalancedFargateService`

This example shows how to control the auto-scaling of
`TmApplicationLoadBalancedFargateService`. The current behavior is kept as the
default, and a complete override is available when you need it.

## Default behavior (unchanged)

If you pass **nothing** scaling-related (or `disableDefaultScaling: false`), the
construct applies its built-in policies exactly as before:

- Target-tracking on **CPU** and **memory** utilization.
- Targets come from `targetCpuUtilizationPercent` / `targetMemoryUtilizationPercent`
  (both default to `30`).
- 60-second scale-in / scale-out cooldowns.
- Capacity bounded by `minTaskCount` / `maxTaskCount` (max defaults to `30`).

```ts
new TmApplicationLoadBalancedFargateService(this, 'Service', {
  vpc,
  buildContextPath: path.join(__dirname, '..', 'build'),
  buildDockerfile: 'Dockerfile',
  containerPort: 80,
  minTaskCount: 2,
  maxTaskCount: 20,
  // No scaling props → the default CPU + memory 30% policies apply.
});
```

## Complete override

Set `disableDefaultScaling: true` to skip the built-in policies entirely. The
construct still creates the `ScalableTaskCount` (with your `minTaskCount` /
`maxTaskCount` bounds) and exposes it as the public **`scalableTaskCount`**
property, so you attach whatever policies you want from your own stack.

```ts
const service = new TmApplicationLoadBalancedFargateService(this, 'Service', {
  vpc,
  buildContextPath: path.join(__dirname, '..', 'build'),
  buildDockerfile: 'Dockerfile',
  containerPort: 80,
  minTaskCount: 2,
  maxTaskCount: 20,
  disableDefaultScaling: true, // ← take full control
});

const scaling = service.scalableTaskCount;

scaling.scaleOnCpuUtilization('CpuTracking', { targetUtilizationPercent: 55 });
scaling.scaleOnMemoryUtilization('MemoryTracking', { targetUtilizationPercent: 70 });
scaling.scaleOnRequestCount('RequestTracking', {
  requestsPerTarget: 1000,
  targetGroup: service.targetGroup,
});
scaling.scaleOnMetric('QueueBacklog', { /* step scaling on a custom metric */ });
scaling.scaleOnSchedule('BusinessHoursUp', { /* scheduled scaling */ });
```

See [`lib/tm-scaling-override-stack.ts`](lib/tm-scaling-override-stack.ts) for the
full runnable version with target-tracking, step, and scheduled scaling all
combined.

## Add extra policies on top of the defaults

If you want to keep the defaults **and** add more policies, omit
`disableDefaultScaling` and just call the extra `scaleOn*` methods on
`service.scalableTaskCount`. The built-in CPU/memory policies and your additions
all apply together — Application Auto Scaling honors whichever policy asks for
the most tasks.

## Why a property, not a method

The scalable target can only be registered **once** per service
(`autoScaleTaskCount()` throws `ScalableTarget already registered` on a second
call). The construct registers it once in its constructor and hands back the
result as `scalableTaskCount`, so consumers attach policies to the same target
without re-registering.

## Useful commands

- `npm run build`  compile TypeScript to JS
- `npx cdk synth`  emit the synthesized CloudFormation template
- `npx cdk diff`   compare deployed stack with current state
