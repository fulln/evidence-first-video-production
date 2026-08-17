#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertValidConfig, deepMerge, readJson } from "./lib/config.mjs";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--target", "--config", "--name"].includes(key)) throw new Error(`未知参数: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} 缺少值`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

function replacements(config) {
  const primary = config.platforms[0];
  return {
    PROJECT_NAME: config.project.name,
    BRAND_NAME: config.brand.series_name,
    FIXED_CLOSING: config.brand.fixed_closing,
    OPENING_SECONDS: config.editorial.opening_commitment_seconds,
    PAYOFF_DEADLINE_SECONDS: config.editorial.cover_payoff_deadline_seconds,
    PRIMARY_WIDTH: primary.width,
    PRIMARY_HEIGHT: primary.height,
    FPS: config.production.fps,
    TARGET_DURATION_SECONDS: config.production.duration_seconds.target,
    VISUAL_SCORE_MIN: config.production.visual_score_min,
    EARLY_REVIEW_HOURS: config.review.early_check_hours,
    MATURE_REVIEW_DAYS: config.review.mature_check_days,
    EPISODE_DATE: "YYYY-MM-DD",
  };
}

function render(text, values) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => String(values[key] ?? match));
}

function copyTemplate(sourceDir, targetDir, values) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      copyTemplate(source, target, values);
      continue;
    }
    if (source.endsWith(path.join("config", "video-production.json"))) continue;
    const buffer = fs.readFileSync(source);
    const isText = [".md", ".json", ".txt", ".yaml", ".yml"].includes(path.extname(source));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, isText ? render(buffer.toString("utf8"), values) : buffer);
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target) throw new Error("必须提供 --target /absolute/path/to/project");

  const target = path.resolve(args.target);
  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    throw new Error(`目标目录不是空目录，拒绝覆盖: ${target}`);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const templateDir = path.resolve(scriptDir, "../assets/project-template");
  const defaultConfigPath = path.join(templateDir, "config/video-production.json");
  let config = readJson(defaultConfigPath);
  if (args.config) config = deepMerge(config, readJson(path.resolve(args.config)));
  if (args.name) config.project.name = args.name;
  assertValidConfig(config);

  fs.mkdirSync(target, { recursive: true });
  copyTemplate(templateDir, target, replacements(config));
  const outputConfigPath = path.join(target, "config/video-production.json");
  fs.mkdirSync(path.dirname(outputConfigPath), { recursive: true });
  fs.writeFileSync(outputConfigPath, `${JSON.stringify(config, null, 2)}\n`);
  for (const relativeDir of [
    config.project.render_output_dir,
    "content/episodes",
    config.delivery.pending_dir,
    config.delivery.backup_dir,
  ]) {
    fs.mkdirSync(path.join(target, relativeDir), { recursive: true });
  }

  console.log(`项目模板已初始化: ${target}`);
  console.log(`下一步编辑并校验: ${outputConfigPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

