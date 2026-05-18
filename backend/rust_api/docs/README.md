# Rust API Docs

这里保留 `backend/rust_api` 目录内的文档兼容入口。

对外 HTTP API、图书馆接口、任务接口、产物下载、事件流和删除语义统一看：

- [RetainPDF 后端 API 总入口](../../../doc/core/api/index.md)

后端实现和协作边界看：

- [Rust API 架构入口](../../../doc/core/rust_api/README.md)
- [当前运行主链](../CURRENT_API_MAP.md)
- [Stage 执行契约](../STAGE_EXECUTION_CONTRACT.md)
- [OCR Provider 契约](../OCR_PROVIDER_CONTRACT.md)
- [渲染参数契约](../RENDER_OPTIONS_CONTRACT.md)
- [目录边界](../RUST_API_DIRECTORY_MAP.md)

原则：

- `doc/core/api/index.md` 是对外 API 唯一真源。
- `backend/rust_api/docs/*` 不再维护第二份接口详情。
- `backend/rust_api/API_SPEC.md` 保留为历史/实现参考，不作为前端首读文档。
