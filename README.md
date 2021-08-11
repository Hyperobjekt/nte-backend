# REST API Template

This repo sets up the required infrastructure to create an AWS hosted REST API using:

- Aurora Serverless (Postgresql + Data API)
- Lambda Endpoints (Express)

## Structure

- `/bin`: contains executable node scripts
- `/lib`: contains code for creating AWS resources
- `/functions`: contains code that handles requests to the API endpoint

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
