# 图书馆 API 契约

图书馆 **对外 HTTP** 已合并到统一 API 入口：

- [RetainPDF 后端 API 总入口](../../../docs/core/api/index.md)

**实现分层**（模块化单体，非微服务）：

```text
routes/library*.rs, collections.rs
  → services/library_api.rs
      → services/library/*
```

协作说明见：

- [RUST_API_ARCHITECTURE.md](../RUST_API_ARCHITECTURE.md) §2.2–2.3
- [RUST_API_DIRECTORY_MAP.md](../RUST_API_DIRECTORY_MAP.md)
- [BOUNDARIES.md](../BOUNDARIES.md)（Library Facade）

保留这个文件是为了兼容旧链接。不要在这里维护第二份接口字段说明。
