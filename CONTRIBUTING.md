## Getting Started

- install AWS CDK (`npm i -g aws-cdk`)
- instal local dependencies (`npm install`)

## Deploying

To deploy, first build the typescript code with:

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
