# 06 Paddle Markdown 到 Job Artifact 映射与边界

这份文档只回答一件事：

- Paddle provider 输出、`normalized_document`、job artifact 导出、下载接口，这四层各自是什么边界

核心结论先写在前面：

1. `provider raw` 是 OCR provider 私有输出，只用于回溯、诊断、adapter 输入，不是下游主契约。
2. `normalized_document` 是 OCR 阶段对翻译/渲染的正式交接物，主链路应该稳定依赖它。
3. `job artifact` 是作业产物注册与导出层，负责把文件暴露成统一 artifact key，不重新定义 provider 语义。
4. 下载接口是 HTTP 暴露层，只承诺“按 artifact 或按稳定资源下载”，不承诺下游理解 provider raw 结构。

## 一张图看边界

```text
Paddle API JSONL / result.json
  -> provider raw boundary
  -> document_schema adapter
  -> ocr/normalized/document.v1.json
  -> normalized_document boundary
  -> translation / rendering
  -> job artifacts registry / virtual bundle
  -> artifact export boundary
  -> /api/v1/jobs/* download routes
  -> download API boundary
```

## 1. Provider Raw Boundary

Paddle provider 当前在 provider-backed 流程里的原始结果文件是：

- `ocr/result.json`

来源代码：

- `backend/scripts/services/ocr_provider/provider_pipeline.py`
  `run_paddle_to_job_dir()` 会把 `download_jsonl_result()` 的聚合结果保存到 `job_dirs.ocr_dir / "result.json"`
- `backend/scripts/services/ocr_provider/paddle_api.py`
  `download_jsonl_result()` 把 JSONL 聚合为：
  - `layoutParsingResults`
  - `dataInfo`
  - `_meta`

这一层的职责只有：

- 保留 Paddle 原始结构
- 给 `document_schema` adapter 提供输入
- 给排错和 provider 对账提供依据

这一层不应该承担的职责：

- 不应该直接作为翻译输入
- 不应该直接作为渲染输入
- 不应该要求 Rust API 或前端理解 `layoutParsingResults` 的字段细节
- 不应该被下载接口包装成“统一文档语义”

也就是说：

- `result.json` 是 provider raw snapshot
- 它可以变
- 只要 adapter 仍能把它稳定映射到 `document.v1`，下游就不应该被迫跟着改

## 2. Normalized Document Boundary

Paddle raw 进入统一契约后的正式输出是：

- `ocr/normalized/document.v1.json`
- `ocr/normalized/document.v1.report.json`

来源代码：

- `backend/scripts/services/ocr_provider/provider_pipeline.py`
  `_save_normalized_document_for_paddle()`
- `backend/scripts/services/document_schema/README.md`

这一层是当前 OCR 到翻译/渲染主链路的稳定交接点。

职责：

- 把 Paddle 私有字段隔离在 adapter 内
- 输出统一的 `normalized_document_v1`
- 让 translation/rendering 只面向稳定结构工作

主链路应该依赖：

- `document.v1.json`

主链路不应该依赖：

- `result.json`
- `layoutParsingResults[*].prunedResult.*`
- Paddle 的 `markdown.images`
- Paddle 的 `group_id/global_group_id`

`document.v1.report.json` 的定位也要明确：

- 它是 normalize 报告和校验摘要
- 用于排错、默认值分析、兼容性检查
- 不是翻译或渲染主输入

## 3. Paddle Markdown 处在什么边界

当前下载层里的 Markdown 不是 Paddle raw API 的正式契约字段，而是 job 目录里的一个可导出产物。

Rust 侧解析 Markdown 的位置：

- `backend/rust_api/src/storage_paths.rs`
  - `resolve_markdown_path()`
  - `resolve_markdown_images_dir()`

当前解析顺序：

1. 优先读 `job_root/md/full.md`
2. 优先读 `job_root/md/images/`
3. 只有兼容旧布局时，才回退到 `provider_raw_dir/full.md` 和 `provider_raw_dir/images/`

这意味着：

- `md/full.md` 和 `md/images/` 属于 job output 结构
- 它们是“对外可下载的 Markdown 产物”
- 它们不是 Paddle raw provider contract 本身

因此不要混淆：

- Paddle raw 里的 `markdown.text` / `markdown.images`
- job 里的 `md/full.md` / `md/images/`

前者属于 provider raw trace。
后者属于 job artifact/export 口径。

当前主链已经按这个边界收口：

- Paddle provider pipeline 会显式执行一次 markdown materialize
- 把 `layoutParsingResults[*].markdown.text/images` 发布到 `job_root/md/full.md` 与 `job_root/md/images/`
- Rust 下载层只读取这套 published artifact，不再从 `provider_raw_dir` 反推

这里有一个非常重要的实现约束：

- Markdown 里的图片相对路径，不能由我们自己拍脑袋生成固定模式
- 必须以 Paddle `markdown.images` 的 key 为准
- 我们当前只允许做一层稳定发布包装：给每页加 `page-N/` 作用域前缀，避免多页 PDF 的同名图片互相覆盖

也就是说，如果 Paddle 原始 Markdown 里写的是：

```html
<img src="imgs/img_in_image_box_320_138_932_438.jpg" ... />
```

那么发布后的 Markdown 应该变成：

```html
<img src="page-6/imgs/img_in_image_box_320_138_932_438.jpg" ... />
```

其中：

- `imgs/img_in_image_box_320_138_932_438.jpg` 这段相对路径来自 provider 原始返回
- `page-6/` 是我们为了多页发布增加的页面作用域

不能把它错误简化成：

- 固定 `imgs/...`
- 固定 `assets/...`
- 固定某种图片命名模板
- 固定某种 Markdown 图片语法

因为 Paddle 返回的正文里既可能是 Markdown `![](...)`，也可能是 HTML `<img src=\"...\">`，相对路径片段也必须完全跟随 provider 返回值。

## 4. Job Artifact Export Boundary

job artifact 的职责是把作业目录里的文件和虚拟产物，统一映射成 artifact key。

关键代码：

- `backend/rust_api/src/storage_paths.rs`
- `backend/rust_api/src/services/artifacts.rs`

这里最关键的不是“文件放哪”，而是“对外暴露成什么 artifact key”。

### 与 Paddle/Normalize/Markdown 直接相关的 artifact key

| artifact key | 含义 | 边界归属 |
| --- | --- | --- |
| `provider_result_json` | provider 原始结果快照 | provider raw |
| `provider_raw_dir` | provider 原始目录 | provider raw |
| `layout_json` | 历史/兼容布局结果入口 | provider raw 或兼容层 |
| `normalized_document_json` | 统一文档契约 | normalized_document |
| `normalization_report_json` | normalize 报告 | normalized_document 辅助物 |
| `markdown_raw` | job 导出的 Markdown 文件 | artifact export |
| `markdown_images_dir` | job 导出的 Markdown 图片目录 | artifact export |
| `markdown_bundle_zip` | 由 API 动态打包的 Markdown bundle | artifact export |

### 这里的边界规则

`services/artifacts.rs` 只负责：

- 从 registry 或 fallback 中找到 artifact
- 为 artifact 生成稳定资源路径
- 按需构建 zip bundle

它不负责：

- 解释 Paddle raw JSON
- 定义 `document.v1` 语义
- 决定某个 block 是否正文

也就是说，artifact 层处理的是：

- 文件是否存在
- 文件属于哪个 group
- 用哪个 artifact key 暴露
- 是否允许直接下载

artifact 层不应该反向变成 provider 语义层。

## 5. 下载接口 Boundary

下载接口是最外层 HTTP 暴露，不应把内部路径结构泄漏成新的业务契约。

关键代码：

- `backend/rust_api/src/services/jobs/facade/query/downloads.rs`
- `backend/rust_api/src/services/artifacts.rs`

### 稳定资源接口

这些接口暴露的是“稳定资源类型”，不是 provider 私有字段：

| 接口 | 对应资源 | 说明 |
| --- | --- | --- |
| `/api/v1/jobs/{job_id}/normalized-document` | `normalized_document_json` | OCR 到下游正式交接物 |
| `/api/v1/jobs/{job_id}/normalization-report` | `normalization_report_json` | normalize 校验/摘要 |
| `/api/v1/jobs/{job_id}/markdown` | `markdown_raw` 的读取视图 | 可返回 JSON 包装或 raw markdown |
| `/api/v1/jobs/{job_id}/markdown/images/{path}` | `markdown_images_dir` 下的文件 | 图片直链 |
| `/api/v1/jobs/{job_id}/artifacts/{artifact_key}` | artifact registry 项 | 通用 artifact 下载 |

### Bundle 接口

`bundle_response()` 会根据 job 当前产物动态打包 zip。

当前 bundle 内容来自：

- `translated_pdf`
- `markdown/full.md`
- `markdown/images/*`

这说明 bundle 是“导出层组合物”，不是新的 schema。

## 6. 为什么这四层必须解耦

如果四层不拆开，后面就会反复重构。

典型错误耦合方式：

1. 让翻译链直接读取 Paddle raw 的 `layoutParsingResults`
2. 让 artifact 导出逻辑去理解 `block_label/group_id`
3. 让下载接口直接承诺 provider 的原始字段结构
4. 把 `markdown.text` 当作下游统一契约，而不是把 `document.v1` 当主输入

正确做法是：

1. provider raw 负责“保真”
2. normalized document 负责“统一”
3. artifact export 负责“注册和导出”
4. download API 负责“按稳定资源暴露”

这样每层变化只影响本层：

- Paddle API 变了：优先改 provider adapter
- `document.v1` 增强了：改 normalize 与下游消费者
- 下载方式变了：改 artifact/export 与 route/facade

而不是整条链一起改。

## 7. 实际开发时的判定规则

遇到一个字段或文件，先问它属于哪层：

### 属于 provider raw

典型例子：

- `result.json`
- `layoutParsingResults`
- `dataInfo`
- `markdown.images`
- `group_id`

处理规则：

- 可以保留
- 可以排错
- 不能作为主链路正式契约

补一条针对 Markdown 图片路径的判断规则：

- `markdown.images` 的 key 是 provider raw 语义的一部分
- published artifact 层不能重命名它内部的相对路径结构
- 允许做的只有“页面作用域隔离”，例如 `page-6/` 前缀
- 不允许把 provider 返回的 `imgs/...` 改写成仓库内部自定义固定目录名

### 属于 normalized_document

典型例子：

- `document.v1.json`
- `document.v1.report.json`

处理规则：

- 这是 OCR 到 translation/rendering 的稳定交接层
- 语义增强优先在 adapter/schema 侧完成

### 属于 artifact export

典型例子：

- `markdown_raw`
- `markdown_images_dir`
- `markdown_bundle_zip`
- `provider_result_json`
- `normalized_document_json`

处理规则：

- 关注 artifact key、ready 状态、相对路径、group、content type
- 不在这里发明新的 provider 语义

### 属于 download API

典型例子：

- `/normalized-document`
- `/normalization-report`
- `/markdown`
- `/artifacts/{artifact_key}`

处理规则：

- 关注资源暴露形式、鉴权、响应头、streaming
- 不在这里解释 Paddle raw 的业务含义

## 8. 文档主口径

以后讨论这块时，统一用下面这套说法：

- `provider raw`：Paddle 原始输出和原始目录
- `normalized_document`：统一文档契约，翻译/渲染正式输入
- `artifact export`：作业产物注册、打包和导出
- `download API`：对外 HTTP 资源暴露

不要再混用下面这些说法：

- “Markdown 就是 Paddle 输出”
- “artifact 就是 schema”
- “下载接口等于 provider contract”
- “只要能下载就能当主链路输入”

这些说法都会把层次重新耦合回去。
