# 配置说明

`config/video-production.json` 是项目的单一配置入口。先修改配置，再修改模板或脚本。

## 可配置项

| 区域 | 作用 | 示例 |
| --- | --- | --- |
| `project` | 项目名、默认语言、目录约定 | 项目显示名、内容目录 |
| `brand` | 栏目识别与语气 | 栏目名、承诺、固定收尾、禁用套话 |
| `editorial` | 受众、内容范围和结构目标 | 目标受众、开头/兑现/收尾时间 |
| `platforms` | 输出尺寸与安全区 | 1080×1920、左右上下遮挡 |
| `production` | 帧率、时长、音频和视觉阈值 | 30fps、45—60 秒、峰值上限 |
| `evidence` | 事实分类和来源要求 | 交叉来源数、素材权利字段 |
| `review` | 单变量实验和规则升级 | T+24h、T+7d、最少重复次数 |
| `delivery` | 待发布目录、备份目录和必需文件 | 视频、封面、文案、来源、manifest |

## 不可放松的系统边界

下列字段存在于配置中，便于审计，但校验器要求保持为 `true`：

- `creative_boundaries.template_structure_not_expression`
- `creative_boundaries.evidence_before_emotion`
- `creative_boundaries.independent_final_review`
- `publishing.require_explicit_authorization`
- `delivery.fail_on_verification_error`

如需改变这些边界，应先修改 Skill 的方法论和校验器，而不是在单个项目中静默关闭。

## 安全区

每个平台的 `safe_area_px` 表示画面四边需要避让的像素。校验器会检查左右之和小于画面宽度、上下之和小于画面高度。

关键标题、人物脸部、数字、字幕和来源说明应位于平台共同安全区。平台 UI 更新后，先更新配置，再重新执行关键帧和平台预览验收。

## 事实分类

默认分类为：

- `event-fact`：事件发生时可确认；
- `period-context`：用于理解事件的时期背景；
- `later-outcome`：后来才发生或才知道的结果。

可以改名或增加分类，但至少保留三个互不重复的类别，并在 `research.md` 与 `storyboard.md` 中使用同一组值。

## 交付文件

`delivery.required_files` 是待发布包的白名单和硬门禁。`manifest_file` 必须同时出现在此数组中。package spec 的 `assets` 必须为除 manifest 外的每个必需文件提供来源。

不要把临时渲染文件、关键帧或低清预览列为正式交付物。

