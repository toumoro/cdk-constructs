# Pour créer un nouvel exemple

```bash
cd examples
mkdir cdk-<nom-du-stack-exemple-pour-le-developpement-de-constructs>
```

Initialisation de CDK
```bash
cd cdk-<nom-du-stack-exemple-pour-le-developpement-de-constructs>
cdk init app --language typescript
```

Mise à jour de la version du construct et de la bibliothèque CDK utilisés dans le construct `cdk-construct-lib`, dans le fichier `package.json` du nouvel exemple:
```json
{
  "devDependencies": {
    [...]
    "aws-cdk": "2.X.X",
    [...]
  },
  "dependencies": {
    "aws-cdk-lib": "2.X.X",
    "constructs": "10.X.X",
    [...]
  }
}
```

Install the dependencies version
```
npm install
```

Suivez le README du projet pour déployer la nouvelle pile.
