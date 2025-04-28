import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';


// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines-readme.html

// Define the properties for the Pipeline construct
export interface TmPipelineProps {
  /**
   * The name of the pipeline.
   */
  readonly pipelineName: string;
  /**
   * The name of the repository.
   */
  readonly repoName: string;
  /**
   * The branch of the repository to use.
   */
  readonly repoBranch: string;
  /**
   * The command to run in the synth step.
   */
  readonly synthCommand?: Array<string>;
  /**
   * The primary output directory.
   */
  readonly primaryOutputDirectory?: string;
}

/**
 * A CDK construct that creates a CodePipeline.
 */
export class TmPipeline extends Construct {
  /**
   * The CodePipeline created by the construct.
   */
  public readonly pipeline: pipelines.CodePipeline;
  /**
   * Constructs a new instance of the PipelineCdk class.
   * @param scope The parent construct.
   * @param id The name of the construct.
   * @param props The properties for the construct.
   * @default - No default properties.
   *  */
  constructor(scope: Construct, id: string, props: TmPipelineProps) {
    super(scope, id);



    // Create a pipeline
    this.pipeline = new pipelines.CodePipeline(this, props.pipelineName, {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub(props.repoName, props.repoBranch),
        // Commands to run in the synth step
        installCommands: ['npm install', 'npm ci', 'npm install -g aws-cdk'],
        commands: props.synthCommand ?? ['npm install', 'npm ci', 'npm install -g aws-cdk', 'cdk synth'],
        primaryOutputDirectory: props.primaryOutputDirectory ?? 'cdk.out',
      }), // Add a closing parenthesis here
    });
  }
}