import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as lambda from "@aws-cdk/aws-lambda";
import * as rds from "@aws-cdk/aws-rds";
import * as apigw from "@aws-cdk/aws-apigatewayv2";
import * as integrations from "@aws-cdk/aws-apigatewayv2-integrations";
import * as s3 from "@aws-cdk/aws-s3";
import * as lambdaEventSources from "@aws-cdk/aws-lambda-event-sources";
import { Duration } from "@aws-cdk/core";
import { CorsHttpMethod } from "@aws-cdk/aws-apigatewayv2";

export class NtepStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * SETUP THE AURORA SERVERLESS DATABASE
     */

    // Create the VPC needed for the Aurora Serverless DB cluster
    const vpc = new ec2.Vpc(this, "AuroraVPC");

    // Create the Serverless Aurora DB cluster; set the engine to Postgres
    const cluster = new rds.ServerlessCluster(this, "AuroraEvictionsCluster", {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(
        this,
        "ParameterGroup",
        "default.aurora-postgresql10"
      ),
      defaultDatabaseName: "EvictionsDB",
      vpc,
      scaling: { autoPause: cdk.Duration.hours(4) },
    });

    /**
     * SETUP THE LAMBDA FUNCTION THAT WILL QUERY AURORA BASED ON HTTP REQUESTS
     */

    const queryFn = new lambda.Function(this, "QueryFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: new lambda.AssetCode("functions/api"),
      handler: "index.handler",
      memorySize: 1024,
      environment: {
        CLUSTER_ARN: cluster.clusterArn,
        SECRET_ARN: cluster.secret?.secretArn || "",
        DB_NAME: "EvictionsDB",
      },
      timeout: Duration.minutes(3),
    });

    // Grant access to the cluster from the Lambda function
    cluster.grantDataApiAccess(queryFn);

    // create the API Gateway with one method and path
    let api = new apigw.HttpApi(this, "Endpoint", {
      defaultIntegration: new integrations.LambdaProxyIntegration({
        handler: queryFn,
      }),
      corsPreflight: {
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
        ],
        allowMethods: [
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
        ],
        allowOrigins: ["*"],
      },
    });

    new cdk.CfnOutput(this, "HTTP API URL", {
      value: api.url ?? "Something went wrong with the deploy",
    });

    /**
     * SETUP DATA LOADER
     * - adds a bucket for storing source data
     * - adds a lambda function that listens for S3 PUT events
     *   - handler function loads data into the DB
     */

    // 1. add a bucket for storing source data
    const bucket = new s3.Bucket(this, "DataStore", {
      // ensure the bucket is properly deleted when running `cdk destroy`
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. create the lambda function that is triggered by S3 PUT events
    const loaderFn = new lambda.Function(this, "LoaderFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("functions/loader"),
      handler: "index.handler",
      description: "handles loading data from S3 bucket into Aurora DB",
      memorySize: 1024,
      environment: {
        BUCKET: bucket.bucketName,
        CLUSTER_ARN: cluster.clusterArn,
        SECRET_ARN: cluster.secret?.secretArn || "",
        DB_NAME: "EvictionsDB",
      },
      timeout: Duration.minutes(15),
    });

    // connect the lambda function to PUT events from S3
    const s3PutEventSource = new lambdaEventSources.S3EventSource(bucket, {
      events: [
        s3.EventType.OBJECT_CREATED_PUT,
        s3.EventType.OBJECT_CREATED_COMPLETE_MULTIPART_UPLOAD,
      ],
    });
    loaderFn.addEventSource(s3PutEventSource);

    // Grant access to the cluster and bucket from the Lambda function
    bucket.grantReadWrite(loaderFn);
    cluster.grantDataApiAccess(loaderFn);
  }
}
