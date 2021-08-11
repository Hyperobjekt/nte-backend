#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { NtepStack } from "../lib/ntep-stack";

const envNtep = { account: "678154373696", region: "us-east-1" };

const app = new cdk.App();
new NtepStack(app, "NtepStack", { env: envNtep });
