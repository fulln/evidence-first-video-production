#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertValidConfig, readJson } from "./lib/config.mjs";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--config", "--package"].includes(key)) throw new Error(`未知参数: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} 缺少值`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config || !args.package) throw new Error("用法: node scripts/verify-publish-package.mjs --config CONFIG --package PACKAGE_DIR");

  const config = readJson(path.resolve(args.config));
  assertValidConfig(config);
  const packageDir = path.resolve(args.package);
  const stat = fs.lstatSync(packageDir, { throwIfNoEntry: false });
  if (!stat?.isDirectory() || stat.isSymbolicLink()) throw new Error(`待发布包不是普通目录: ${packageDir}`);

  const manifestPath = path.join(packageDir, config.delivery.manifest_file);
  const manifest = readJson(manifestPath);
  if (manifest.schema_version !== 1) throw new Error("manifest.schema_version 必须为 1");
  if (manifest.package_name !== path.basename(packageDir)) throw new Error("manifest.package_name 与目录名不一致");
  if (!Number.isInteger(manifest.version) || manifest.version < 1) throw new Error("manifest.version 必须是正整数");
  const duration = config.production.duration_seconds;
  if (!Number.isFinite(manifest.duration_seconds) || manifest.duration_seconds < duration.min || manifest.duration_seconds > duration.max) {
    throw new Error(`manifest.duration_seconds 必须在 ${duration.min}—${duration.max} 之间`);
  }

  for (const fileName of config.delivery.required_files) {
    const filePath = path.join(packageDir, fileName);
    const fileStat = fs.lstatSync(filePath, { throwIfNoEntry: false });
    if (!fileStat?.isFile() || fileStat.isSymbolicLink() || fileStat.size === 0) throw new Error(`必需文件不存在、为空或不是普通文件: ${fileName}`);
    if (fileName === config.delivery.manifest_file) continue;
    const record = manifest.files?.[fileName];
    if (!record) throw new Error(`manifest 缺少文件记录: ${fileName}`);
    if (record.size_bytes !== fileStat.size) throw new Error(`文件大小不匹配: ${fileName}`);
    if (record.sha256 !== sha256(filePath)) throw new Error(`SHA-256 不匹配: ${fileName}`);
  }

  const expectedRecords = config.delivery.required_files.filter((name) => name !== config.delivery.manifest_file).sort();
  const actualRecords = Object.keys(manifest.files ?? {}).sort();
  if (JSON.stringify(expectedRecords) !== JSON.stringify(actualRecords)) {
    throw new Error("manifest.files 与配置的交付文件不一致");
  }

  console.log(`待发布包校验通过: ${packageDir}`);
  console.log(`版本: ${manifest.version}; 文件数: ${actualRecords.length}; 时长: ${manifest.duration_seconds}s`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

