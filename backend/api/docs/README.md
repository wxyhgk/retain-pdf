# Rust API Docs

这里保留 `backend/api` 目录内的实现文档与兼容入口。

对外 HTTP API、图书馆接口、任务接口、产物下载、事件流和删除语义统一看：

- [docs/api/](../../../docs/api/README.md)（唯一的对外接口说明；[接口目录](../../../docs/api/00-接口目录.md)从接口登记表生成）

内部设计（运行时、配置、存储、事件、实现备忘）看：

- [docs/core/api/](../../../docs/core/api/README.md)

`API_SPEC.md` 和 `api-spec/` 2026-11-24 起不再写内容，只留指向上面两处的说明。

后端实现和协作边界看：

- [Rust API 架构入口](../../../docs/core/rust_api/README.md)
- [当前运行主链](../CURRENT_API_MAP.md)
- [Stage 执行契约](../STAGE_EXECUTION_CONTRACT.md)
- [OCR Provider 契约](../OCR_PROVIDER_CONTRACT.md)
- [渲染参数契约](../RENDER_OPTIONS_CONTRACT.md)
- [目录边界](../RUST_API_DIRECTORY_MAP.md)
- [业务目录与边界统一迁移计划与执行状态](../../../docs/ops/planning/api-boundary-migration.md)

原则：

- `docs/api/` 是对外 API 唯一真源，改接口行为就改那里对应的篇（2026-11-24 起）。
- `docs/core/api/` 只放内部设计：Rust/Python 编排、诊断、恢复的实现思路。
- `backend/api/API_SPEC.md`、`backend/api/docs/api-spec/` 不再写内容。
