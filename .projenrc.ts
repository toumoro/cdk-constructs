import { awscdk } from 'projen';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Toumoro ',
  authorAddress: 'https://www.toumoro.com/',
  authorOrganization: true,
  cdkVersion: '2.270.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '^5.9.0',
  name: 'tm-cdk-constructs',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/toumoro/cdk-constructs.git',
  description: 'A CDK construct library',
  license: 'GPL-3.0-or-later',
  gitignore: ['.venv', '.env', '__pycache__/'],
  devDeps: [
    'cdk',
    'ts-node',
  ],

  deps: ['cdk-nag'], /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
  // @ts-ignore - "npmPublishOptions" is hidden by the JsiiProject type definition but supported by the underlying NodeProject
  publishToNpm: {
    trustedPublishing: true,
    npmProvenance: true, // Optional: defaults to true if trustedPublishing is on
  },
  publishToPypi: {
    distName: 'tm-cdk-constructs',
    module: 'tm_cdk_constructs',
  },
  // majorVersion: 1,
  stability: 'experimental',
});

project.addPackageIgnore('examples');

// L'actif de la Lambda d'amorçage (handler Python + pymysql vendu) n'est pas du
// TypeScript : jsii/tsc ne le copie pas vers lib/. On le recopie après la
// compilation pour que le paquet publié (lib/) contienne l'actif que le
// construct charge via `path.join(__dirname, 'bootstrap-lambda')`.
project.postCompileTask.exec(
  'rm -rf lib/stacks/data/bootstrap-lambda && ' +
  'mkdir -p lib/stacks/data && ' +
  'cp -r src/stacks/data/bootstrap-lambda lib/stacks/data/bootstrap-lambda && ' +
  'find lib/stacks/data/bootstrap-lambda -name __pycache__ -type d -prune -exec rm -rf {} +',
);

project.synth();
