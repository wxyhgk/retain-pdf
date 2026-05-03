# API 文档

这里记录 RetainPDF 当前真实对外 API。文档口径以 Rust 路由、前端实际调用和 Docker 交付配置为准。

## 阅读顺序

1. [服务总览](./overview.md)
2. [本地启动与配置](./local-dev.md)
3. [接口说明](./endpoints.md)
4. [后端 API 主文档](./backend.md)
5. [存储结构](./storage.md)
6. [错误排查](./troubleshooting.md)
7. [Rust API 联调说明](../rust_api/README.md)

## 当前核心约定

- 除 `GET /health` 外，`/api/v1/*` 默认都需要 `X-API-Key`。
- `POST /api/v1/jobs` 只接受 grouped JSON：`source / ocr / translation / render / runtime`。
- 旧扁平字段只保留在 multipart 辅助入口，例如 OCR-only 和简便同步接口。
- 前端状态和下载按钮应优先读取 `actions`、`artifacts`、`artifacts-manifest`，不要只靠 `status` 推断文件是否可用。

## 实现参考

- [backend/rust_api/API_SPEC.md](../../backend/rust_api/API_SPEC.md)
- [backend/rust_api/src/app/router.rs](../../backend/rust_api/src/app/router.rs)
- [backend/rust_api/OCR_Service_API.md](../../backend/rust_api/OCR_Service_API.md)
