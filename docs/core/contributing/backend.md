# Rust API 贡献指南

## 分层方向

默认依赖方向：

```text
rust_api app/router -> routes -> services/facades
services/facades -> retain-core + retain-data
retain-jobs -> retain-core + retain-data + retain-proc
retain-jobsd -> retain-jobs + retain-data
```

基本规则：

- `src/app/router/*` 只装配路由；`src/routes/*` 只做 HTTP adapter、提取器和响应包装。
- `src/services/*` 放应用用例、facade 和安全 projection，不直接拥有 worker 生命周期。
- `crates/retain-core` 只放跨 crate 的领域类型、配置和稳定 DTO，不反向依赖 HTTP、SQLite 或 runner。
- `crates/retain-data` 拥有 SQLite、artifact/credential 读取以及 provider 数据边界。
- `crates/retain-jobs` 拥有队列、stage 编排、进程拉起、取消、OCR dispatch 和恢复。
- `crates/retain-proc` 只提供通用子进程安全原语；`retain-jobsd` 是独立任务监督入口。
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
