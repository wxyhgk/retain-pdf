# Rust API 贡献指南

## 包名

2026-10-17 起 Rust 包统一叫 `retainpdf-*`，和 Python 的 `retainpdf-math`、`retainpdf-pipeline` 一个写法；
`backend/packages/`、`database/` 下的目录名就是包名。应用目录（`backend/api`、`backend/jobs`、`backend/cli`）和可执行文件名没改：

| 目录 | 包名（`cargo -p`） | crate 名（`use`） | 可执行文件 |
|---|---|---|---|
| `backend/api` | `retainpdf-api` | `retainpdf_api` | `rust_api`、`retainpdf-agent` |
| `backend/packages/retainpdf-api-base` | `retainpdf-api-base` | `retainpdf_api_base` | |
| `backend/packages/retainpdf-accounts` | `retainpdf-accounts` | `retainpdf_accounts` | |
| `backend/packages/retainpdf-files` | `retainpdf-files` | `retainpdf_files` | |
| `backend/packages/retainpdf-glossaries` | `retainpdf-glossaries` | `retainpdf_glossaries` | |
| `backend/packages/retainpdf-ingest` | `retainpdf-ingest` | `retainpdf_ingest` | |
| `backend/packages/retainpdf-jobs` | `retainpdf-jobs` | `retainpdf_jobs` | |
| `backend/packages/retainpdf-library` | `retainpdf-library` | `retainpdf_library` | |
| `backend/packages/retainpdf-platform` | `retainpdf-platform` | `retainpdf_platform` | |
| `backend/packages/retainpdf-providers` | `retainpdf-providers` | `retainpdf_providers` | |
| `backend/packages/retainpdf-core` | `retainpdf-core` | `retainpdf_core` | |
| `backend/packages/retainpdf-data` | `retainpdf-data` | `retainpdf_data` | |
| `database/retainpdf-db` | `retainpdf-db` | `retainpdf_db` | |
| `backend/packages/retainpdf-config` | `retainpdf-config` | `retainpdf_config` | |
| `backend/packages/retainpdf-proc` | `retainpdf-proc` | `retainpdf_proc` | |
| `backend/packages/retainpdf-runner` | `retainpdf-runner` | `retainpdf_runner` | |
| `backend/jobs` | `retainpdf-runnerd` | | `retain-jobsd` |
| `backend/cli` | `retainpdf-cli` | | `retainpdf` |

Python 的翻译 agent 包 `retainpdf-translation-agent`（`backend/translation-agent`，2026-10-29 新建）：一次翻一整页、逐块校验、
按重排 agent 的要求改稿，只用标准库；测试系统在 `backend/pipeline/devtools/agent_lab/`。以后的重排 agent 另建 `retainpdf-layout-agent`。
2026-10-30 起翻译包依赖它：任务选 `translation.engine=agent` 时由 `retainpdf_translation/workflow/agent_flow.py` 调（见 [翻译层说明](../python/translation.md)），运行时镜像也装它。
Rust 的底座包 `retainpdf-api-base` 和 Python 的底座包 `retainpdf-base`（`backend/base`，翻译拆包时新建）是两个东西。`retainpdf-api-base`（2026-10-16 新建）是 API 各领域包共用的底座：
错误类型 `AppError` 和按编号读出任务 `job_loading`，在 `services` 下面一层。

## 分层方向

默认依赖方向：

```text
rust_api app/router -> routes -> services（8 个领域包的门面）
领域包（retainpdf-jobs 等） -> retainpdf-api-base + retainpdf-core + retainpdf-data（任务包另用 retainpdf-runner、retainpdf-proc）
retainpdf-runner -> retainpdf-core + retainpdf-data + retainpdf-proc
retain-jobsd -> retainpdf-runner + retainpdf-data
```

基本规则：

- `src/app/router/*` 只装配路由；`src/routes/*` 只做 HTTP adapter、提取器和响应包装。
- 应用用例、facade 和安全 projection 放在 8 个领域包里（`backend/packages/retainpdf-<领域>`；`src/services/mod.rs` 只把它们接成 `crate::services::<领域>`），不直接拥有 worker 生命周期。
- `backend/packages/retainpdf-core` 只放跨 crate 的领域类型、配置和稳定 DTO，不反向依赖 HTTP、SQLite 或 runner。
- `database/retainpdf-db` 拥有 SQLite（`retainpdf-data` 重导出成 `db`）；`backend/packages/retainpdf-data` 拥有 artifact/credential 读取、worker 命令以及 provider 数据边界。
- `backend/packages/retainpdf-runner` 拥有队列、stage 编排、进程拉起、取消、OCR dispatch 和恢复。
- `backend/packages/retainpdf-proc` 只提供通用子进程安全原语；`retain-jobsd` 是独立任务监督入口。
- 不要为了省事把 `AppState` 传进只需要 `Db`、`AppConfig`、`Path` 或 semaphore 的 helper。

更细规则见 [Rust API 协同开发约定](../rust_api/09-协同开发约定.md)。

## API 改动

- 新增公开 API 字段时，使用稳定 view/model，不要把内部 `JobSnapshot` 字段直接暴露出去。
- 新增或改变接口、事件、产物 manifest、reader metadata、diagnostics、resume 行为时，更新 [API 文档](../api/index.md) 或对应 rust_api 文档。
- API 返回字段优先从 view/projection 层输出，不要在 route 里临时拼 JSON。
- 下载、预览、Range、ETag、reader regions 这类前端强依赖接口，应保持字段稳定和向后兼容。
- 改共享线协议时，同时更新 `backend/contracts`、`contracts` 和 producer/consumer 契约测试。
- 公共凭据只用 `credential_ref`；响应、日志、事件和 stage spec 都不得出现原始 secret。

## 常用检查

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
cargo fmt --manifest-path "$BACKEND_ROOT/api/Cargo.toml" --check
cargo test --locked --workspace --manifest-path "$BACKEND_ROOT/api/Cargo.toml"
python3 "$BACKEND_ROOT/api/scripts/check_architecture.py"
```

后端是产品仓库中的自包含 package；路径和校验规则见[内嵌后端 Package](./backend-package.md)。

## PR 说明

涉及 Rust API 的 PR 至少说明：

- 影响哪些 endpoint 或内部 service。
- 是否改变 job、artifact、reader、library、resume、diagnostics 等契约。
- 是否需要更新前端、桌面端或 API 文档。
- 已跑哪些 Rust 检查；没跑的说明原因。
