# API 文档

这里放 Rust 后端的对外接口总索引。真正详细的联调口径优先看 [Rust API 说明](../rust_api/README.md)。

## 阅读顺序

1. [服务总览](./overview.md)
2. [接口说明](./endpoints.md)
3. [后端 API 主文档](./backend.md)
4. [存储结构](./storage.md)
5. [错误排查](./troubleshooting.md)
6. [本地启动与配置](./local-dev.md)
7. [Rust API 说明](../rust_api/README.md)

## 核心约定

- 除 `GET /health` 外，业务接口默认都需要 `X-API-Key`
- `POST /api/v1/jobs` 只接受 grouped JSON
- 旧扁平字段只保留在少数 multipart 辅助入口
- 前端按钮状态优先读 `actions` 和 `artifacts`
- 任务详情和事件流的详细语义优先看 `doc/core/rust_api`

## 实现参考

- [backend/rust_api/API_SPEC.md](../../backend/rust_api/API_SPEC.md)
- [backend/rust_api/src/app/router.rs](../../backend/rust_api/src/app/router.rs)
- [backend/rust_api/OCR_Service_API.md](../../backend/rust_api/OCR_Service_API.md)
