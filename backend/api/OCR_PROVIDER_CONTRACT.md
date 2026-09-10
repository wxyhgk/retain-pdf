# OCR Provider Contract

这份文档只回答一个问题：

**在 `rust_api` 里，OCR provider 这一层到底负责什么，不负责什么。**

相关文档：

- 总体架构边界：
  [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
- 当前运行主链：
  [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
- stage 运行时契约：
  [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
- Paddle OCR API 摘要：
  [`../packages/retain-data/src/ocr_provider/paddle/API_SUMMARY.md`](../packages/retain-data/src/ocr_provider/paddle/API_SUMMARY.md)

## 1. 目标

`ocr_provider` 这一层的目标不是跑完整 OCR 流程，而是提供：

- provider 身份识别
- provider 能力声明
- provider transport client
- provider 状态映射
- provider 错误分类

也就是：

- “这个 provider 是谁”
- “它支持什么”
- “它返回的状态是什么意思”
- “它失败时怎么归类”

## 2. 当前目录

- [../packages/retain-data/src/ocr_provider/mod.rs](../packages/retain-data/src/ocr_provider/mod.rs)
- [../packages/retain-data/src/ocr_provider/types.rs](../packages/retain-data/src/ocr_provider/types.rs)
- [../packages/retain-data/src/ocr_provider/catalog.rs](../packages/retain-data/src/ocr_provider/catalog.rs)
- [../packages/retain-data/src/ocr_provider/mineru](../packages/retain-data/src/ocr_provider/mineru)
- [../packages/retain-data/src/ocr_provider/paddle](../packages/retain-data/src/ocr_provider/paddle)

## 3. 分工

### 3.1 `types.rs`

负责 provider 共享数据结构：

- `OcrProviderKind`
- `OcrProviderCapabilities`
- `OcrProviderDiagnostics`
- `OcrTaskStatus`
- `OcrProviderErrorInfo`

规则：

- 这里放共享 contract
- 不放 provider 专属 transport 逻辑

### 3.2 `catalog.rs`

负责 provider 元信息注册：

- `provider_definition`
- `provider_capabilities`
- `is_supported_provider`
- `ensure_provider_diagnostics`

规则：

- 新增 provider 时，先在这里注册
- `capabilities` 的唯一汇总口必须在这里
- `diagnostics` 初始化逻辑不要散落到 runner 各处

### 3.3 `<provider>/client.rs`

负责 provider 通信：

- 构造请求
- 调外部 API
- 解析响应

不负责：

- job 生命周期
- 路由返回
- translation/render 决策

### 3.4 `<provider>/status.rs`

负责 provider 原始状态到统一状态的映射。

例如：

- provider raw state -> `OcrTaskState`
- provider raw message -> stage/detail

### 3.5 `<provider>/errors.rs`

负责 provider 错误到统一错误分类的映射。

例如：

- invalid token
- expired token
- upload failed
- poll timeout

## 4. 依赖方向

允许：

```text
job_runner -> ocr_provider
ocr_provider/catalog -> ocr_provider/<provider>
ocr_provider/<provider> -> ocr_provider/types
```

禁止：

```text
ocr_provider -> routes
ocr_provider -> services/jobs/presentation
ocr_provider -> translation/render logic
```

## 5. 当前运行时约定

`job_runner` 侧现在只应该通过这些统一入口消费 provider 元信息：

- `parse_provider_kind`
- `require_supported_provider`
- `provider_definition`
- `provider_capabilities`
- `ensure_provider_diagnostics`

特别是：

- `OcrProviderDiagnostics` 初始化不要在多个模块手写
- 当前已经统一收口到 `ensure_provider_diagnostics`

## 6. 新增 provider 的最小步骤

如果以后接第三个 provider，最小步骤应该是：

1. 新建 `../packages/retain-data/src/ocr_provider/<provider>/`
2. 实现：
   - `client.rs`
   - `status.rs`
   - `errors.rs`
3. 在 `catalog.rs` 注册：
   - `kind`
   - `key`
   - `capabilities`
4. 在 `mod.rs` 暴露 provider 模块
5. 在 `job_runner/ocr_flow` 接入 transport 分发

不应该做的事：

- 不在 `routes` 里加 provider 特判
- 不在 `services/jobs/facade` 里加 provider 特判
- 不在 `process_runner` 里加 provider 初始化逻辑

## 6.1 和 `job_runner/ocr_flow` 的边界

`ocr_provider` 和 `job_runner/ocr_flow` 现在按下面分工：

- `ocr_provider`
  负责 provider client、状态映射、错误分类、能力声明
- `job_runner/ocr_flow`
  负责 OCR 子任务运行态编排、workspace、provider raw/result 落盘、normalize 衔接

进一步说：

- `ocr_flow/mod.rs`
  是 OCR 子流程唯一 orchestrator
- provider client 的构造、本地/远程 transport 分支选择
  也必须收口在 `ocr_flow/mod.rs`
- `ocr_flow/*` 其他子模块不能重新长成第二个 orchestrator
- provider raw token 的理解应尽量收敛在专门 helper
  例如 Paddle Markdown artifact helper

## 7. 边界红线

### 红线 1

provider 层不做完整 job orchestration。

### 红线 2

provider 层不决定翻译策略。

### 红线 3

provider 层不返回 HTTP view model。

### 红线 4

provider 能力声明只能有一个注册口，不能到处 `match kind`.

当前这个注册口就是：

- [catalog.rs](../packages/retain-data/src/ocr_provider/catalog.rs)
