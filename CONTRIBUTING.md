## Getting Started

- install AWS CDK (`npm i -g aws-cdk`)
- install local dependencies (`npm install` in the root of the repo **and** in the `/functions/api/` and `/functions/loader/` subdirectories, which have separate package.jsons)

## Data flow

New data is deployed by uploading a new source file (NTEP_eviction_cases.csv) to the `filing_data` directory of the [cpal-evictions](https://github.com/childpovertyactionlab/cpal-evictions) repo. The data file must be formatted as described in the [data dictionary](https://github.com/Hyperobjekt/nte-backend/blob/main/docs).

An Action registered to that repo will trigger (through [this helper](https://github.com/Hyperobjekt/s3-upload-github-action)) an upload of that file to an S3 bucket (one for staging, one for production).

This in turn will trigger an AWS Lambda function (this repo's `loader/index.ts`), which clears the database and loads entries from the new source file (the env variables for this process can be viewed in the Configuration tab of the Lambda function). (The execution of the loader function will log to CloudWatch, as described in `Troubleshooting` below.) It is an Aurora PostgreSQL database and can be accessed through Amazon RDS (use the Query Editor to confirm changes have loaded successfully).

See [api-and-infrastructure.md](./docs/api-and-infrastructure.md#rest-api) for more on the endpoint which fields the FE app's database queries.

## Deploying

To deploy changes to infrastructure or lambda functions, first build the typescript code with:

```
npm run build
```

then deploy with cdk

```
cdk deploy
```

> Note: you may want to specify a profile with cdk deploy if you are not using the default profile

## Common Errors

### Error when running `cdk deploy`

```
Error: Cannot find module 'source-map-support/register'
```

Resolve by reinstalling aws-cdk

```
npm uninstall -g aws-cdk
npm install -g aws-cdk
```

### Troubleshooting / Confirming the data was updated correctly

You can confirm the data update was successful by logging into the AWS console and navigating to CloudWatch > Log Groups.

In the log groups there will be an entry that contains `NtepStack-LoaderFunction` and looks something like this:

```
/aws/lambda/NtepStack-LoaderFunction{SOME_CHARACTERS}
```

Select this log group, then click on the most recent log stream in the list of log streams. Within this log stream you should see information indicating the insert was successful.

```
2021-08-10T17:54:52.481-07:00	2021-08-11T00:54:52.480Z 252d37f5-db59-4b81-b7b5-b69c05e97aba INFO setting up tables
...
2021-08-11T00:57:39.675Z 252d37f5-db59-4b81-b7b5-b69c05e97aba INFO ... 209000 rows inserted
...
2021-08-10T17:57:39.714-07:00	2021-08-11T00:57:39.714Z 252d37f5-db59-4b81-b7b5-b69c05e97aba INFO finished inserting data
```

If there were any problems loading the dataset, you will see errors in the log and can troubleshoot based on those.
