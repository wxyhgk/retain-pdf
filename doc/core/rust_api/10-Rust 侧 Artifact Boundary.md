# Rust 侧 Artifact Boundary

这份文档只回答一个问题：

Rust API 现在如何看待 `provider raw / normalized / published artifact / download API` 这四层边界。

## 1. 四层边界

```text
provider raw
  -> normalized
  -> published artifact
  -> download API
```

四层的职责必须稳定分开。

## 2. Provider Raw

这一层是 provider 自己的原始结果或原始目录快照。

Rust 侧只把它当成“可登记、可下载、可排错”的 provider 产物，不把它当统一文档契约。

当前典型 key：

- `provider_result_json`
- `provider_bundle_zip`
- `provider_raw_dir`
- `layout_json`

这一层允许：

- 保留 provider 原始结构
- 作为排错和回溯依据
- 作为 normalize 前的输入来源

这一层不允许：

- 让下载 API 承诺 provider 私有字段语义
- 让 artifact registry 理解 `layoutParsingResults` 之类的 provider 字段
- 让下游翻译/渲染直接稳定依赖 provider raw 结构

## 3. Normalized

这一层是 OCR 阶段对下游的正式交接物。

当前正式文件：

- `normalized_document_json`
- `normalization_report_json`

Rust 侧应把它看成：

- OCR 到翻译/渲染的稳定结构边界
- 对外可下载的正式文档资源

Rust 侧不应把 provider raw 和 normalized 混成一个概念。

尤其是：

- `normalized-document` 下载口只对应 `normalized_document_json`
- `normalization-report` 下载口只对应 `normalization_report_json`

## 4. Published Artifact

这一层是 Rust API 的 artifact registry / published artifact 口径。

它的职责是：

- 给任务目录里的文件分配稳定 `artifact_key`
- 生成统一 manifest
- 提供统一资源路径
- 处理 bundle 这类导出组合物

它不负责：

- 理解 provider raw 内部字段
- 定义 normalize 语义
- 推断正文、结构、公式等文档语义

换句话说：

- `provider raw` 是“原始输入快照”
- `normalized` 是“统一文档契约”
- `published artifact` 是“Rust 对外发布这些文件时的注册层”

三者不是一层。

## 5. Download API

下载 API 是最外层 HTTP 暴露层。

它只承诺两类事情：

- 稳定资源下载
- 按 `artifact_key` 的统一 artifact 下载

它不承诺：

- provider 私有字段结构
- job 目录物理布局
- provider raw 的内部 JSON 语义

因此：

- `/normalized-document` 暴露的是 normalized 边界
- `/normalization-report` 暴露的是 normalized 辅助物
- `/artifacts/{artifact_key}` 暴露的是 published artifact 边界
- provider raw 只有在显式下载对应 artifact key 时才暴露为“原始文件”，不是“统一语义接口”

## 6. 当前 Rust 侧落点

Rust 侧与这四层最直接相关的文件是：

- `backend/rust_api/src/storage_paths.rs`
- `backend/rust_api/src/services/artifacts/mod.rs`
- `backend/rust_api/src/routes/jobs/download.rs`

这三处的边界约定是：

- `storage_paths.rs`
  负责路径约定、artifact key、文件解析和 published artifact 发现
- `services/artifacts/*`
  负责 artifact registry、bundle 构建、资源路径映射
- `routes/jobs/download.rs`
  负责 HTTP 下载入口适配

它们都不应该开始理解 provider raw 的内部字段。

## 7. 一句话判定规则

如果一个改动需要 Rust 下载层去理解 provider raw JSON 的字段名，那通常已经越界了。

正确方向通常是：

- provider 变化，改 adapter / normalize
- published artifact 变化，改 `storage_paths.rs` / `services/artifacts/*`
- HTTP 暴露变化，改下载 route / facade
