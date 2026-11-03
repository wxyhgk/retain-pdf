# Rust API Docs

这份索引只回答一个问题：

**现在看 `rust_api` 文档，先看哪篇。**

## 建议阅读顺序

1. 对外 HTTP API、图书馆接口和前端接入：
   [`../docs/core/api/index.md`](../../docs/core/api/index.md)；
   全部接口一张表（方法、地址、谁能用、旧地址，从接口登记表生成）：
   [`docs/api/00-接口目录.md`](../../docs/api/00-接口目录.md)
2. 当前系统到底怎么跑：
   [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
3. 先看目录，知道改哪里：
   [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
4. 团队协作边界和分层规则：
   [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
5. Rust 侧 artifact 四层边界：
   [`10-Rust 侧 Artifact Boundary.md`](../../docs/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
6. Rust 和 Python stage spec 契约：
   [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
7. 阶段事件与失败协议：
   [`../docs/core/rust_api/11-阶段事件与失败协议.md`](../../docs/core/rust_api/11-%E9%98%B6%E6%AE%B5%E4%BA%8B%E4%BB%B6%E4%B8%8E%E5%A4%B1%E8%B4%A5%E5%8D%8F%E8%AE%AE.md)
8. job_runner 运行态边界：
   [`../docs/core/rust_api/12-job_runner 边界.md`](../../docs/core/rust_api/12-job_runner%20%E8%BE%B9%E7%95%8C.md)
9. OCR provider 边界：
   [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
10. Paddle OCR 异步 API 摘要：
   [`../packages/retainpdf-data/src/ocr_provider/paddle/API_SUMMARY.md`](../packages/retainpdf-data/src/ocr_provider/paddle/API_SUMMARY.md)
11. Paddle Markdown / artifact 边界：
   [`../docs/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../docs/core/paddle_ocr_api/06_job_artifact_boundary.md)

## 每篇文档解决什么问题

- [`CURRENT_API_MAP.md`](CURRENT_API_MAP.md)
  只看当前正式运行主链，重点回答“请求进来后，Rust 和 Python 到底怎么串起来”。
- [`RUST_API_DIRECTORY_MAP.md`](RUST_API_DIRECTORY_MAP.md)
  只看当前目录职责，重点回答“应该先进哪个目录改代码”。
- [`RUST_API_ARCHITECTURE.md`](RUST_API_ARCHITECTURE.md)
  只看当前团队协作边界，重点回答“改哪里才对，哪些层不能乱穿透”。
- [`10-Rust 侧 Artifact Boundary.md`](../../docs/core/rust_api/10-Rust%20%E4%BE%A7%20Artifact%20Boundary.md)
  只看 Rust 侧 artifact boundary，重点回答“provider raw / normalized / published artifact / download API 四层各负责什么”。
- [`../docs/core/api/index.md`](../../docs/core/api/index.md)
  只看外部 HTTP 行为，重点回答“接口怎么调、返回什么、哪些字段是正式契约”。
- [`API_SPEC.md`](API_SPEC.md)
  Rust API 的实现契约索引；不是前端首读文档，但也不是历史快照。
- [`STAGE_EXECUTION_CONTRACT.md`](STAGE_EXECUTION_CONTRACT.md)
  只看 stage worker 的 spec 协议，重点回答“Rust 如何给 Python 传执行输入”。
- [`../docs/core/rust_api/11-阶段事件与失败协议.md`](../../docs/core/rust_api/11-%E9%98%B6%E6%AE%B5%E4%BA%8B%E4%BB%B6%E4%B8%8E%E5%A4%B1%E8%B4%A5%E5%8D%8F%E8%AE%AE.md)
  只看状态/事件/失败正式协议，重点回答“Python 怎么发事件、Rust 怎么 canonicalize、前端该消费哪些字段”。
- [`../docs/core/rust_api/12-job_runner 边界.md`](../../docs/core/rust_api/12-job_runner%20%E8%BE%B9%E7%95%8C.md)
  只看运行态执行层边界，重点回答“改 job_runner 时逻辑应该放在哪个模块”。
- [`OCR_PROVIDER_CONTRACT.md`](OCR_PROVIDER_CONTRACT.md)
  只看 provider adapter 边界，重点回答“MinerU / Paddle 在哪一层分发和收口”。
- [`../packages/retainpdf-data/src/ocr_provider/paddle/API_SUMMARY.md`](../packages/retainpdf-data/src/ocr_provider/paddle/API_SUMMARY.md)
  只看 Paddle OCR 异步接口协议，重点回答“submit / poll / result download 到底怎么走”。
- [`../docs/core/paddle_ocr_api/06_job_artifact_boundary.md`](../../docs/core/paddle_ocr_api/06_job_artifact_boundary.md)
  只看 Markdown 发布边界，重点回答“provider raw 为什么不能直接当 job markdown artifact”。

## 当前推荐认知路径

- 想快速理解系统：
  `README -> RUST_API_DIRECTORY_MAP -> CURRENT_API_MAP -> RUST_API_ARCHITECTURE`
- 想改后端代码：
  `RUST_API_DIRECTORY_MAP -> RUST_API_ARCHITECTURE -> 10-Rust 侧 Artifact Boundary -> CURRENT_API_MAP -> 对应源码`
- 想接前端或第三方：
  `docs/core/api/index.md -> CURRENT_API_MAP`

## 当前查询与事件边界

- `JobQueries` 只接收数据库与数据根，不装配任务提交、执行或 replay 能力。
- 同步查询通过独立 `QueryExecution` 限制阻塞工作；下载使用 `JobDownloads`
  和独立生成调度器，相同产物生成可共享执行。
- 普通／OCR 事件（`/jobs/:id/progress/events`）已统一升级为 cursor v2，旧 `offset` 请求不再支持；
  API、契约、SDK 与第一方客户端需一起发布。翻译实时推送 SSE 不变（地址现为 `/jobs/:id/progress/stream`，原 `/live-events` 已于 2026-10-18 删除）。
  详见 [事件 v2 协议与迁移说明](../../docs/core/api/event-feed-v2.md)。

## 架构门禁

后端改动默认至少跑这几项：

- `python3 backend/api/scripts/check_architecture.py`
- `python3 -B -m unittest discover -s backend/api/scripts -p 'test_check_*.py'`
- `uv run --project backend --locked --all-extras python backend/api/scripts/check_test_filters.py`
- `uv run --project backend --locked --all-extras cargo build --locked -p retainpdf-api`
- `uv run --project backend --locked --all-extras cargo test --locked -p retainpdf-runner --lib job_runner::process_runner::tests::execute_process_job_injects_provider_and_translation_envs -- --exact`
- `uv run --project backend --locked --all-extras cargo test --locked -p retainpdf-api --lib api_tests::jobs_security::job_detail_and_events_routes_redact_secrets -- --exact`

以上命令从仓库根目录执行。`check_test_filters.py` 只通过 `cargo test -- --list`
确认两个精确过滤器匹配实际测试（必要时会编译测试二进制，不执行测试），匹配 0 项即失败；
它不能替代后面的实际测试。运行时测试现在属于 `retainpdf-runner`，HTTP 脱敏测试属于
`retainpdf_api::api_tests`，不要继续使用迁移前的 crate/模块路径。

第一条负责卡住最容易回退的架构问题：

- `AppState` 回流到 `services/job_runner/ocr_provider`
- `routes` 直接依赖 `job_runner`
- `routes/jobs/*` 重新手写局部 `route_deps(...)`
- 已迁移的 jobs 只读/下载路由重新装配完整 `JobsFacade`；Reader AI / translation replay 命令除外
- `JobQueries` / 下载模块（含拆分后的子模块）重新持有任务提交、运行时控制、上传或 replay 能力
- `routes` 直接 `state.db` / `state.config`，或绕过 facade import 内部 service
- library / glossary / upload route 不经 `*_api` 入口
- `ProcessRuntimeDeps::new(...)` 在 `app` 边界层之外被随手组装
- `JobPersistDeps` 从 leaf helper 边界重新外溢
- `runtime_deps` 结构体被重新散落回多个 runner 文件
- `state.rs` 重新把 stale running job recovery 混回 bootstrap
- `lifecycle.rs` 重新退化回一个大函数，丢掉已收口的 helper 边界
- artifact/download 边界层重新开始理解 provider raw 内部字段
- published markdown artifact 重新从 `provider_raw_dir/full.md|images` 反推
