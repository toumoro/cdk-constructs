# Pour créer un nouvel exemple

```bash
cd examples
mkdir tm-<nom-du-stack-exemple-pour-le-developpement-de-constructs>
```

Initialisation de CDK
```bash
cd tm-<nom-du-stack-exemple-pour-le-developpement-de-constructs>
cdk init app --language typescript
```

Remove devDependencies et dependencies from package.json
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

Remove node_modules from new example
```
rm -r tm-example/node_modules
```

Suivez le README du projet pour déployer la nouvelle pile.
