#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { EvictionsStack } from "../lib/evictions-stack";

const app = new cdk.App();
//678154373696 CPAL Account
//318011162599 Hyperobjekt Account

new EvictionsStack(app, "NtepStack", { env: { account: "318011162599", region: "us-east-1" } });
new EvictionsStack(app, "TulsaStack", { env: { account: "318011162599", region: "us-east-1" } });


