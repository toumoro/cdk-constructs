import * as codecommit from 'aws-cdk-lib/aws-codecommit';
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
   * The command to run in the synth step.
   */
  readonly synthCommand?: string[];
  /**
   * The primary output directory.
   */
  readonly primaryOutputDirectory?: string;

  /*
   * The name of the repository.
   * This is used only if the source is not provided.
   */
  readonly repoName?: string;
  /**
   * The branch of the repository to use.
   * This is used only if the source is not provided.
   */
  readonly repoBranch?: string;

  /*
   * The source of the pipeline.
   * This is used if repoName and repoBranch are not provided.
   */
  readonly source?: pipelines.CodePipelineSource;

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

    // If the source is not provided, use the CodeCommit source
    let input: pipelines.CodePipelineSource;
    if (props.source) {
      input = props.source;
    } else if (props.repoName && props.repoBranch) {
      // Define a CodeCommit repository
      const repository = codecommit.Repository.fromRepositoryName(this, props.repoName, props.repoName);
      input = pipelines.CodePipelineSource.codeCommit(repository, props.repoBranch);
    } else {
      throw new Error('You must provide either source or both repoName and repoBranch');
    }

    // Create a pipeline
    this.pipeline = new pipelines.CodePipeline(this, props.pipelineName, {
      synth: new pipelines.ShellStep('Synth', {
        input: input,
        // Commands to run in the synth step
        installCommands: ['npm install', 'npm ci', 'npm install -g aws-cdk'],
        commands: props.synthCommand ?? ['npm install', 'npm ci', 'npm install -g aws-cdk', 'cdk synth'],
        primaryOutputDirectory: props.primaryOutputDirectory ?? 'cdk.out',
      }), // Add a closing parenthesis here
    });
  }
}