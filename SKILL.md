---
name: evidence-first-video-production
description: 为事实型、知识型、品牌型短视频建立可配置的稳定生产系统，覆盖栏目定位、证据核验、脚本、分镜、动效、声音、逐级验收、待发布包和发布后单变量实验。用于初始化新视频项目、把现有生产方法抽成模板、制作单期内容、审查交付完整性，或将一次性流程改造成可复用 Skill；不用于把创意表达批量参数化，也不在未获明确授权时上传或发布内容。
---

# Evidence-first Video Production

将稳定的生产纪律做成配置和门禁，同时为每期叙事与视觉表达保留重新设计的空间。

## 初始化项目

1. 运行：

   ```bash
   node scripts/init-project.mjs --target /absolute/path/to/project
   ```

2. 如已有配置，运行：

   ```bash
   node scripts/init-project.mjs \
     --target /absolute/path/to/project \
     --config /absolute/path/to/custom-config.json
   ```

3. 编辑生成的 `config/video-production.json`，再运行：

   ```bash
   node scripts/validate-config.mjs /absolute/path/to/project/config/video-production.json
   ```

4. 阅读 [references/configuration.md](references/configuration.md)，区分可配置项与不可放松的系统边界。

不得向非空目录初始化；不得静默覆盖已有模板。

## 执行单期生产

1. 读取项目配置、最近一次成熟复盘与本期实验卡。
2. 从 `content/_templates/` 创建单期内容包。
3. 按 `research.md` 核验事实、日期、来源、素材权利和可说边界。
4. 锁定核心命题后写 `script.md`；让封面承诺在配置规定的时间内兑现。
5. 先按信息任务设计分镜和 styleframe，再选择动效语法；不要从动效模板反推内容。
6. 依次完成关键帧、局部片段、完整预览、独立终检和技术校验。失败时只返回受影响层修改。
7. 生成待发布包并校验文件、清单和 SHA-256；任何校验失败都不得声称完成。
8. 仅在获得明确授权后执行上传或发布。待发布包生成不等于发布授权。

完整门禁与证据要求见 [references/workflow.md](references/workflow.md)。

## 保持创作边界

- 复用安全区、字幕、素材加载、相对时间轴、来源标注、渲染和验证脚本。
- 每期重新设计信息路径、主构图、镜头顺序、节奏与声音落点。
- 把镜头卡当作动作词汇，不把“卡名 + 标题 + 数字 + 色彩”做成成片生成器。
- 先核验事实，再添加情绪；不得用后来的结果冒充当时已知信息。
- 每幕只保留一个主信息和一个主焦点；辅助动作必须帮助理解。
- 使用真实资料时记录来源、日期、授权和现场属性；不得用生成图冒充历史或新闻证据。
- 逐帧画面必须可复现；使用固定种子，不使用时间或无种子随机数驱动画面。

核心原则与推导见 [references/principles.md](references/principles.md)。

## 构建待发布包

准备一份 package spec，字段示例见初始化项目中的 `publish-package.example.json`，然后运行：

```bash
node scripts/build-publish-package.mjs \
  --config /absolute/path/to/project/config/video-production.json \
  --spec /absolute/path/to/project/publish-package.json

node scripts/verify-publish-package.mjs \
  --config /absolute/path/to/project/config/video-production.json \
  --package /absolute/path/to/project/publish/pending/YYYY-MM-DD-topic
```

更新已有包时仅在明确知道目标后添加 `--replace`。构建器会把旧包移到配置的备份目录，而不是直接删除。

## 复盘与规则升级

- 发布前只登记一个主要假设、一个变量、必须保留项和对应指标。
- 早期数据只用于排除事故和生成下一次实验，不直接升级规则。
- 仅在达到配置中的成熟时长、跨题材次数和反证要求后升级稳定规则。
- 缺失的指标保持缺失；不得用播放量替代曝光、进入率或留存指标。
- 事实、来源、授权、平台安全区和技术交付底线不参与流量优化。

## 完成报告

报告以下内容：

- 使用的配置路径与单期内容包路径；
- 通过的门禁及对应证据；
- 待发布包路径、版本和校验结果；
- 本期唯一实验变量与保留项；
- 未验证项和残余风险；
- 是否仅生成待发布包，或已获得发布授权。

