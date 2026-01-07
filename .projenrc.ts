import { awscdk } from 'projen';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Toumoro ',
  authorAddress: 'https://www.toumoro.com/',
  authorOrganization: true,
  cdkVersion: '2.233.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '^5.2.0',
  name: 'tm-cdk-constructs',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/toumoro/cdk-constructs.git',
  description: 'A CDK construct library',
  license: 'GPL-3.0-or-later',
  gitignore: ['.venv', '.env'],
  npmignore: ['examples'],
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
    module: 'tm-cdk-constructs',
  },
  // majorVersion: 1,
  stability: 'experimental',
});

project.synth();
