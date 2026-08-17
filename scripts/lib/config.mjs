import fs from "node:fs";
import path from "node:path";

const REQUIRED_TRUE_PATHS = [
  "creative_boundaries.template_structure_not_expression",
  "creative_boundaries.evidence_before_emotion",
  "creative_boundaries.independent_final_review",
  "publishing.require_explicit_authorization",
  "delivery.fail_on_verification_error",
];

function valueAt(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], object);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge(base, override) {
  if (!isObject(base) || !isObject(override)) {
    return structuredClone(override);
  }

  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    result[key] = isObject(value) && isObject(result[key])
      ? deepMerge(result[key], value)
      : structuredClone(value);
  }
  return result;
}

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`无法读取 JSON ${filePath}: ${error.message}`);
  }
}

export function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.normalize(value);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

export function validateConfig(config) {
  const errors = [];
  const requireString = (value, label) => {
    if (typeof value !== "string" || value.trim() === "") errors.push(`${label} 必须是非空字符串`);
  };
  const requirePositive = (value, label) => {
    if (!Number.isFinite(value) || value <= 0) errors.push(`${label} 必须是正数`);
  };

  if (config?.schema_version !== 1) errors.push("schema_version 必须为 1");
  requireString(config?.project?.name, "project.name");
  requireString(config?.project?.default_language, "project.default_language");
  requireString(config?.brand?.series_name, "brand.series_name");
  requireString(config?.brand?.audience_promise, "brand.audience_promise");
  requirePositive(config?.editorial?.opening_commitment_seconds, "editorial.opening_commitment_seconds");
  requirePositive(config?.editorial?.cover_payoff_deadline_seconds, "editorial.cover_payoff_deadline_seconds");

  if (!Array.isArray(config?.platforms) || config.platforms.length === 0) {
    errors.push("platforms 至少需要一个平台");
  } else {
    const ids = new Set();
    config.platforms.forEach((platform, index) => {
      const prefix = `platforms[${index}]`;
      requireString(platform?.id, `${prefix}.id`);
      if (ids.has(platform?.id)) errors.push(`${prefix}.id 不能重复`);
      ids.add(platform?.id);
      requirePositive(platform?.width, `${prefix}.width`);
      requirePositive(platform?.height, `${prefix}.height`);
      const safe = platform?.safe_area_px;
      for (const side of ["left", "right", "top", "bottom"]) {
        if (!Number.isFinite(safe?.[side]) || safe[side] < 0) errors.push(`${prefix}.safe_area_px.${side} 必须是非负数`);
      }
      if (safe && safe.left + safe.right >= platform.width) errors.push(`${prefix} 左右安全区不能占满画面`);
      if (safe && safe.top + safe.bottom >= platform.height) errors.push(`${prefix} 上下安全区不能占满画面`);
    });
  }

  requirePositive(config?.production?.fps, "production.fps");
  const duration = config?.production?.duration_seconds;
  requirePositive(duration?.min, "production.duration_seconds.min");
  requirePositive(duration?.target, "production.duration_seconds.target");
  requirePositive(duration?.max, "production.duration_seconds.max");
  if (duration && !(duration.min <= duration.target && duration.target <= duration.max)) {
    errors.push("production.duration_seconds 必须满足 min <= target <= max");
  }
  requirePositive(config?.production?.visual_score_min, "production.visual_score_min");

  const factClasses = config?.evidence?.fact_classes;
  if (!Array.isArray(factClasses) || factClasses.length < 3) {
    errors.push("evidence.fact_classes 至少需要三个事实类别");
  } else if (new Set(factClasses).size !== factClasses.length || factClasses.some((item) => typeof item !== "string" || !item)) {
    errors.push("evidence.fact_classes 必须是互不重复的非空字符串");
  }
  requirePositive(config?.evidence?.minimum_primary_sources, "evidence.minimum_primary_sources");

  for (const dottedPath of REQUIRED_TRUE_PATHS) {
    if (valueAt(config, dottedPath) !== true) errors.push(`${dottedPath} 是不可关闭的系统边界，必须为 true`);
  }
  if (config?.review?.one_primary_variable_per_episode !== true) {
    errors.push("review.one_primary_variable_per_episode 必须为 true");
  }
  requirePositive(config?.review?.early_check_hours, "review.early_check_hours");
  requirePositive(config?.review?.mature_check_days, "review.mature_check_days");
  requirePositive(config?.review?.rule_promotion?.minimum_positive_repetitions, "review.rule_promotion.minimum_positive_repetitions");
  requirePositive(config?.review?.rule_promotion?.minimum_topic_categories, "review.rule_promotion.minimum_topic_categories");

  const delivery = config?.delivery;
  if (!isSafeRelativePath(delivery?.pending_dir)) errors.push("delivery.pending_dir 必须是项目内相对路径");
  if (!isSafeRelativePath(delivery?.backup_dir)) errors.push("delivery.backup_dir 必须是项目内相对路径");
  requireString(delivery?.manifest_file, "delivery.manifest_file");
  if (!Array.isArray(delivery?.required_files) || delivery.required_files.length === 0) {
    errors.push("delivery.required_files 不能为空");
  } else {
    const uniqueFiles = new Set(delivery.required_files);
    if (uniqueFiles.size !== delivery.required_files.length) errors.push("delivery.required_files 不能重复");
    for (const file of delivery.required_files) {
      if (!isSafeRelativePath(file) || path.basename(file) !== file) {
        errors.push(`delivery.required_files 只允许包根目录文件名: ${file}`);
      }
    }
    if (!uniqueFiles.has(delivery?.manifest_file)) errors.push("delivery.manifest_file 必须包含在 delivery.required_files 中");
  }

  return errors;
}

export function assertValidConfig(config) {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error(`配置校验失败:\n- ${errors.join("\n- ")}`);
  }
}

export function resolveProjectRoot(configPath) {
  const configDir = path.dirname(path.resolve(configPath));
  return path.basename(configDir) === "config" ? path.dirname(configDir) : configDir;
}

