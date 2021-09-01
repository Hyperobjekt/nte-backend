## Getting Started

- install AWS CDK (`npm i -g aws-cdk`)
- instal local dependencies (`npm install`)

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

## Common Tasks

### Updating the dataset

New data can be deployed by uploading a new source file to the source data bucket (AWS permissions required).

When a new file is uploaded to the S3 source data, an AWS Lambda function is triggered that clears the database and loads entries from the new source file.

The data file must be formatted as described in the [data dictionary](https://github.com/Hyperobjekt/nte-backend/blob/main/docs).

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
