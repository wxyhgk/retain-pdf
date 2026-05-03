# Rust API Docs

这份索引只回答一个问题：

**现在看 `rust_api` 文档，先看哪篇。**

## 建议阅读顺序

1. 当前系统到底怎么跑：
   [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
2. 先看目录，知道改哪里：
   [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
3. 团队协作边界和分层规则：
   [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
4. Rust 侧 artifact 四层边界：
   [`10-Rust 侧 Artifact Boundary.md`](../../doc/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
5. 对外 HTTP API 协议：
   [`API_SPEC.md`](API_SPEC.md)
6. Rust 和 Python stage spec 契约：
   [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
7. 阶段事件与失败协议：
   [`../doc/core/rust_api/11-阶段事件与失败协议.md`](../../doc/core/rust_api/11-%E9%98%B6%E6%AE%B5%E4%BA%8B%E4%BB%B6%E4%B8%8E%E5%A4%B1%E8%B4%A5%E5%8D%8F%E8%AE%AE.md)
8. OCR provider 边界：
   [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
9. Paddle OCR 异步 API 摘要：
   [`src/ocr_provider/paddle/API_SUMMARY.md`](src/ocr_provider/paddle/API_SUMMARY.md)
10. Paddle Markdown / artifact 边界：
   [`../doc/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../doc/core/paddle_ocr_api/06_job_artifact_boundary.md)

## 每篇文档解决什么问题

- [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
  只看当前正式运行主链，重点回答“请求进来后，Rust 和 Python 到底怎么串起来”。
- [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
  只看当前目录职责，重点回答“应该先进哪个目录改代码”。
- [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
  只看当前团队协作边界，重点回答“改哪里才对，哪些层不能乱穿透”。
- [`10-Rust 侧 Artifact Boundary.md`](../../doc/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
  只看 Rust 侧 artifact boundary，重点回答“provider raw / normalized / published artifact / download API 四层各负责什么”。
- [`API_SPEC.md`](API_SPEC.md)
  只看外部 HTTP 行为，重点回答“接口怎么调、返回什么、哪些字段是正式契约”。
- [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
  只看 stage worker 的 spec 协议，重点回答“Rust 如何给 Python 传执行输入”。
- [`../doc/core/rust_api/11-阶段事件与失败协议.md`](../../doc/core/rust_api/11-%E9%98%B6%E6%AE%B5%E4%BA%8B%E4%BB%B6%E4%B8%8E%E5%A4%B1%E8%B4%A5%E5%8D%8F%E8%AE%AE.md)
  只看状态/失败收口方向，重点回答“前后端与 Rust/Python 应该围绕哪套正式字段对齐”。
- [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
  只看 provider adapter 边界，重点回答“MinerU / Paddle 在哪一层分发和收口”。
- [`src/ocr_provider/paddle/API_SUMMARY.md`](src/ocr_provider/paddle/API_SUMMARY.md)
  只看 Paddle OCR 异步接口协议，重点回答“submit / poll / result download 到底怎么走”。
- [`../doc/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../doc/core/paddle_ocr_api/06_job_artifact_boundary.md)
  只看 Markdown 发布边界，重点回答“provider raw 为什么不能直接当 job markdown artifact”。

## 当前推荐认知路径

- 想快速理解系统：
  `README -> RUST_API_DIRECTORY_MAP -> CURRENT_API_MAP -> RUST_API_ARCHITECTURE`
- 想改后端代码：
  `RUST_API_DIRECTORY_MAP -> RUST_API_ARCHITECTURE -> 10-Rust 侧 Artifact Boundary -> CURRENT_API_MAP -> 对应源码`
- 想接前端或第三方：
  `API_SPEC -> CURRENT_API_MAP`

## 架构门禁

后端改动默认至少跑这几项：

- `python3 backend/rust_api/scripts/check_architecture.py`
- `cargo build --manifest-path backend/rust_api/Cargo.toml`
- `cargo test --manifest-path backend/rust_api/Cargo.toml --lib job_runner::process_runner::tests::execute_process_job_injects_provider_and_translation_envs`
- `cargo test --manifest-path backend/rust_api/Cargo.toml --lib routes::jobs::query::tests::job_detail_and_events_routes_redact_secrets`

第一条负责卡住最容易回退的架构问题：

- `AppState` 回流到 `services/job_runner/ocr_provider`
- `routes` 直接依赖 `job_runner`
- `routes/jobs/*` 重新手写局部 `route_deps(...)`
- `ProcessRuntimeDeps::new(...)` 在 `app` 边界层之外被随手组装
- `JobPersistDeps` 从 leaf helper 边界重新外溢
- `runtime_deps` 结构体被重新散落回多个 runner 文件
- `state.rs` 重新把 stale running job recovery 混回 bootstrap
- `lifecycle.rs` 重新退化回一个大函数，丢掉已收口的 helper 边界
- artifact/download 边界层重新开始理解 provider raw 内部字段
- published markdown artifact 重新从 `provider_raw_dir/full.md|images` 反推
