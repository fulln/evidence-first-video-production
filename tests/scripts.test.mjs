import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;

function run(script, args) {
  return execFileSync(node, [path.join(repoRoot, "scripts", script), ...args], { encoding: "utf8" });
}

test("初始化、构建和校验待发布包", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-video-skill-"));
  const project = path.join(tempRoot, "project");
  try {
    const initOutput = run("init-project.mjs", ["--target", project, "--name", "Smoke Test"]);
    assert.match(initOutput, /项目模板已初始化/);

    const configPath = path.join(project, "config/video-production.json");
    assert.match(run("validate-config.mjs", [configPath]), /配置校验通过/);
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    const requiredAssets = config.delivery.required_files.filter((name) => name !== config.delivery.manifest_file);
    const assets = {};
    for (const outputName of requiredAssets) {
      const source = path.join("fixtures", outputName);
      const sourcePath = path.join(project, source);
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.writeFileSync(sourcePath, `fixture:${outputName}\n`);
      assets[outputName] = source;
    }

    const packageName = "2026-08-17-smoke-test";
    const specPath = path.join(project, "publish-package.json");
    fs.writeFileSync(specPath, `${JSON.stringify({
      package_name: packageName,
      version: 1,
      duration_seconds: config.production.duration_seconds.target,
      metadata: { title: "Smoke Test" },
      assets,
    }, null, 2)}\n`);

    assert.match(run("build-publish-package.mjs", ["--config", configPath, "--spec", specPath]), /待发布包已构建/);
    const packageDir = path.join(project, config.delivery.pending_dir, packageName);
    assert.match(run("verify-publish-package.mjs", ["--config", configPath, "--package", packageDir]), /校验通过/);

    assert.throws(
      () => run("build-publish-package.mjs", ["--config", configPath, "--spec", specPath]),
      /Command failed/,
    );
    const updatedSpec = JSON.parse(fs.readFileSync(specPath, "utf8"));
    updatedSpec.version = 2;
    fs.writeFileSync(specPath, `${JSON.stringify(updatedSpec, null, 2)}\n`);
    assert.match(
      run("build-publish-package.mjs", ["--config", configPath, "--spec", specPath, "--replace"]),
      /旧包已备份.*待发布包已构建/s,
    );
    assert.equal(fs.readdirSync(path.join(project, config.delivery.backup_dir)).length, 1);
    assert.match(run("verify-publish-package.mjs", ["--config", configPath, "--package", packageDir]), /版本: 2/);

    fs.appendFileSync(path.join(packageDir, requiredAssets[0]), "tampered\n");
    assert.throws(
      () => run("verify-publish-package.mjs", ["--config", configPath, "--package", packageDir]),
      /Command failed/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("局部配置可覆盖模板，但不可关闭硬边界", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-video-config-"));
  try {
    const customConfigPath = path.join(tempRoot, "custom.json");
    fs.writeFileSync(customConfigPath, `${JSON.stringify({
      brand: {
        series_name: "事实实验室",
        fixed_closing: "下期继续核对一个问题。",
      },
      editorial: {
        cover_payoff_deadline_seconds: 12,
      },
    }, null, 2)}\n`);
    const project = path.join(tempRoot, "custom-project");
    run("init-project.mjs", ["--target", project, "--config", customConfigPath]);
    const configPath = path.join(project, "config/video-production.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    assert.equal(config.brand.series_name, "事实实验室");
    assert.match(fs.readFileSync(path.join(project, "content/_templates/research.md"), "utf8"), /栏目：事实实验室/);
    assert.match(fs.readFileSync(path.join(project, "content/_templates/script.md"), "utf8"), /不晚于 12 秒/);

    config.publishing.require_explicit_authorization = false;
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    assert.throws(() => run("validate-config.mjs", [configPath]), /Command failed/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
