#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EvictionsStack } from "../lib/evictions-stack";

const app = new cdk.App();
//678154373696 CPAL Account
//318011162599 Hyperobjekt Account

const AWS_ACCOUNT_ID = '318011162599'

// new EvictionsStack(app, "NtepStack", { env: { account: AWS_ACCOUNT_ID region: "us-east-1" } });
new EvictionsStack(app, "TulsaStack", { env: { account: AWS_ACCOUNT_ID, region: "us-east-1" } });


