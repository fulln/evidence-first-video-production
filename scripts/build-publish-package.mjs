#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assertValidConfig, isSafeRelativePath, readJson, resolveProjectRoot } from "./lib/config.mjs";

function parseArgs(argv) {
  const result = { replace: false };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--replace") {
      result.replace = true;
      continue;
    }
    if (!["--config", "--spec"].includes(key)) throw new Error(`未知参数: ${key}`);
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

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

let stagingDir;
try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.config || !args.spec) throw new Error("用法: node scripts/build-publish-package.mjs --config CONFIG --spec SPEC [--replace]");

  const configPath = path.resolve(args.config);
  const config = readJson(configPath);
  assertValidConfig(config);
  const specPath = path.resolve(args.spec);
  const spec = readJson(specPath);
  const projectRoot = resolveProjectRoot(configPath);

  if (typeof spec.package_name !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(spec.package_name)) {
    throw new Error("package_name 只能包含 Unicode 字母、数字和短横线，且不能包含路径分隔符");
  }
  if (!Number.isInteger(spec.version) || spec.version < 1) throw new Error("version 必须是正整数");
  const duration = config.production.duration_seconds;
  if (!Number.isFinite(spec.duration_seconds) || spec.duration_seconds < duration.min || spec.duration_seconds > duration.max) {
    throw new Error(`duration_seconds 必须在 ${duration.min}—${duration.max} 之间`);
  }
  if (!spec.assets || typeof spec.assets !== "object" || Array.isArray(spec.assets)) throw new Error("assets 必须是目标文件名到源文件的对象");

  const manifestName = config.delivery.manifest_file;
  const expectedAssets = config.delivery.required_files.filter((name) => name !== manifestName);
  const actualAssets = Object.keys(spec.assets);
  const missing = expectedAssets.filter((name) => !actualAssets.includes(name));
  const unexpected = actualAssets.filter((name) => !expectedAssets.includes(name));
  if (missing.length) throw new Error(`package spec 缺少资产: ${missing.join(", ")}`);
  if (unexpected.length) throw new Error(`package spec 包含未声明资产: ${unexpected.join(", ")}`);

  const pendingDir = path.resolve(projectRoot, config.delivery.pending_dir);
  const backupDir = path.resolve(projectRoot, config.delivery.backup_dir);
  const targetDir = path.join(pendingDir, spec.package_name);
  fs.mkdirSync(pendingDir, { recursive: true });
  stagingDir = fs.mkdtempSync(path.join(pendingDir, ".building-"));

  const files = {};
  for (const outputName of expectedAssets) {
    const sourceRelative = spec.assets[outputName];
    if (!isSafeRelativePath(sourceRelative)) throw new Error(`资产源路径必须位于项目内: ${sourceRelative}`);
    const sourcePath = path.resolve(projectRoot, sourceRelative);
    const stat = fs.lstatSync(sourcePath, { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size === 0) throw new Error(`资产不存在、为空或不是普通文件: ${sourcePath}`);
    const outputPath = path.join(stagingDir, outputName);
    fs.copyFileSync(sourcePath, outputPath);
    const outputStat = fs.statSync(outputPath);
    files[outputName] = { size_bytes: outputStat.size, sha256: sha256(outputPath) };
  }

  const manifest = {
    schema_version: 1,
    package_name: spec.package_name,
    version: spec.version,
    status: "pending",
    duration_seconds: spec.duration_seconds,
    built_at: new Date().toISOString(),
    metadata: spec.metadata ?? {},
    files,
  };
  fs.writeFileSync(path.join(stagingDir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);

  if (fs.existsSync(targetDir)) {
    if (!args.replace) throw new Error(`待发布包已存在，拒绝覆盖: ${targetDir}`);
    fs.mkdirSync(backupDir, { recursive: true });
    const backupTarget = path.join(backupDir, `${spec.package_name}-${timestamp()}`);
    fs.renameSync(targetDir, backupTarget);
    console.log(`旧包已备份: ${backupTarget}`);
  }
  fs.renameSync(stagingDir, targetDir);
  stagingDir = undefined;
  console.log(`待发布包已构建: ${targetDir}`);
} catch (error) {
  if (stagingDir && fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
  console.error(error.message);
  process.exit(1);
}

