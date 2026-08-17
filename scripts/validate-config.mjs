#!/usr/bin/env node
import path from "node:path";
import { assertValidConfig, readJson } from "./lib/config.mjs";

const configPath = process.argv[2];
if (!configPath) {
  console.error("用法: node scripts/validate-config.mjs /absolute/path/to/video-production.json");
  process.exit(2);
}

try {
  const resolved = path.resolve(configPath);
  assertValidConfig(readJson(resolved));
  console.log(`配置校验通过: ${resolved}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

