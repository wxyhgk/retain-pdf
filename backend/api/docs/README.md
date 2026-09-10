# Rust API Docs

这里保留 `backend/api` 目录内的实现文档与兼容入口。

对外 HTTP API、图书馆接口、任务接口、产物下载、事件流和删除语义统一看：

- [RetainPDF 后端 API 总入口](../../../docs/core/api/index.md)

Rust API 的详细实现契约按领域维护在：

- [Rust API Spec 入口](../API_SPEC.md)
- [分领域实现契约目录](../API_SPEC.md#contract-map)

后端实现和协作边界看：

- [Rust API 架构入口](../../../docs/core/rust_api/README.md)
- [当前运行主链](../CURRENT_API_MAP.md)
- [Stage 执行契约](../STAGE_EXECUTION_CONTRACT.md)
- [OCR Provider 契约](../OCR_PROVIDER_CONTRACT.md)
- [渲染参数契约](../RENDER_OPTIONS_CONTRACT.md)
- [目录边界](../RUST_API_DIRECTORY_MAP.md)
- [业务目录与边界统一迁移计划与执行状态](../../../docs/ops/planning/api-boundary-migration.md)

原则：

- `docs/core/api/index.md` 是对外 API 唯一真源。
- `docs/core/api/index.md` 维护前端与第三方调用所需的公共契约。
- `backend/api/API_SPEC.md` 及 `backend/api/docs/api-spec/*` 维护更详细的
  Rust/Python 编排、诊断、恢复和内部 Agent 实现契约，不作为前端首读文档。
