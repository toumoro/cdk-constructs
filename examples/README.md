# To create a new example

```bash
cd examples
mkdir tm-<name-of-the-example-stack-for-construct-development>
```

### Initializing CDK

```bash
cd tm-<name-of-the-example-stack-for-construct-development>
cdk init app --language typescript
```

### Remove devDependencies and dependencies from `package.json`

```json
{
  "name": "tm-example",
  "version": "0.1.0",
  "bin": {
    "tm-example": "bin/tm-example.js"
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "cdk": "cdk"
  }
}
```

### Remove `node_modules` from the new example

```bash
rm -r tm-example/node_modules
```

### Remove `tsconfig.json` from examples because we are going to use the one from the root

```bash
rm -rf tsconfig.json
```
