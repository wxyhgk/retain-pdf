# MinerU Provider Rust 重构任务

目标：

- 在 `rust_api` 内建立独立的 OCR provider API 层
- 先实现 `MinerU` 这个 provider
- 不要把 MinerU API 细节继续耦合到当前翻译/渲染工作流
- 把 provider 的状态、错误、原始产物信息整理成稳定的 Rust 结构，方便排错和后续接别的 OCR API

## 范围

这次只改 `rust_api`。

允许改动：

- `rust_api/src/**`
- 必要时补 `rust_api/api.md` / `rust_api/API_SPEC.md`

不要改：

- Python 翻译主线
- Python 渲染主线
- `document_schema` 主契约

## 目录目标

在 `rust_api/src/` 下新增独立 provider 层，建议形态：

- `ocr_provider/mod.rs`
- `ocr_provider/types.rs`
- `ocr_provider/mineru/mod.rs`
- `ocr_provider/mineru/client.rs`
- `ocr_provider/mineru/models.rs`
- `ocr_provider/mineru/status.rs`
- `ocr_provider/mineru/errors.rs`

可以根据实现微调，但要求：

- MinerU API 代码放进独立文件夹
- 状态映射独立
- 错误映射独立
- 不要把 MinerU HTTP 调用继续堆在 `routes/` 或 `job_runner.rs`

## 必做目标

### 1. 定义 OCR provider 层基础类型

至少需要这些类型：

- `OcrProviderKind`
- `OcrTaskState`
- `OcrTaskHandle`
- `OcrTaskStatus`
- `OcrArtifactSet`
- `OcrProviderCapabilities`

要求：

- `OcrTaskState` 是内部统一状态，不直接暴露 MinerU 原始状态字面值
- 但 `OcrTaskStatus` 要保留 provider 原始状态字段，方便排错

建议统一状态至少包括：

- `Queued`
- `WaitingUpload`
- `Running`
- `Converting`
- `Succeeded`
- `Failed`
- `Unknown`

### 2. 实现 MinerU 原始状态 -> 内部状态映射

要覆盖 README 里已经明确出现的状态：

- `waiting-file`
- `pending`
- `running`
- `converting`
- `done`
- `failed`

要求：

- 保留原始状态字符串
- 同时给出内部统一状态
- 提供人类可读的 stage/detail 文案生成入口

### 3. 实现 MinerU 原始错误 -> 内部错误分类

至少要能承接：

- HTTP 状态错误
- 授权错误
- 上传链接申请失败
- 上传失败
- 轮询超时
- provider 返回 failed
- 结果下载失败
- 结果解包失败
- provider 返回结构缺字段

要求：

- 错误类型不要只是字符串
- 需要保留 provider 原始 message / code / trace_id 等上下文
- 要便于 API 层直接返回清晰错误

### 4. 把 MinerU API 调用抽成独立 client

至少整理出：

- 申请上传链接
- 上传文件
- 查询 batch / task 状态
- 下载结果

要求：

- `job_runner.rs` 不再直接承担 MinerU API 语义
- 路由层只负责接请求和返回响应
- provider client 负责 HTTP 调用和响应解析

### 5. 为排错补状态与原始信息输出

这是重点，不能只做“能跑”。

至少要有：

- provider 原始状态
- provider task_id / batch_id
- trace_id
- 原始错误码 / 错误信息
- full_zip_url 是否可用
- 上传链接申请阶段、上传阶段、轮询阶段分别处于什么状态

如果合适，可以挂到：

- job 的扩展 artifacts / diagnostics 字段
- 或新增 provider diagnostics 结构

要求：

- 后续前端和排错接口能直接消费
- 避免以后再靠读长日志排错

### 6. 补最小测试

至少补：

- 状态映射测试
- 错误映射测试
- 关键响应解析测试

如果时间够，再补：

- provider 状态文案测试

## 非目标

这次不要做：

- 不要改 Python `services/mineru/`
- 不要改 `document_schema`
- 不要把整个工作流搬到 Rust
- 不要开始接第二个 OCR provider

## 工程原则

- 这只是 provider API 层，不是业务工作流层
- MinerU 是一个 provider 实现，不是系统主契约
- 后续别的 OCR API 也应能复用这一层的抽象
- 你不只在写“MinerU 支持”，你是在写“多 OCR provider 的第一版骨架”

## 交付要求

完成后请给出：

1. 新增/修改了哪些文件
2. 当前 provider 层有哪些稳定类型
3. 已覆盖哪些 MinerU 状态
4. 已覆盖哪些错误分类
5. 跑了哪些测试 / `cargo check`
