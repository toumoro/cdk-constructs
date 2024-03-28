from projen.awscdk import AwsCdkPythonApp

project = AwsCdkPythonApp(
    author_email="ega.fosso@gmail.com",
    author_name="Ega Fosso",
    cdk_version="2.1.0",
    module_name="cdk_constructs",
    name="cdk-constructs",
    version="0.1.0",
)

project.synth()