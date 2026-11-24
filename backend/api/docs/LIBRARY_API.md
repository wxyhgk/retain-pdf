# 图书馆 API 契约

图书馆 **对外 HTTP** 看 docs/api（唯一的对外接口说明）：

- [书与文档](../../../docs/api/13-书库/01-书与文档.md)、[合集、标签与检索](../../../docs/api/13-书库/02-合集标签与检索.md)、[元数据建议](../../../docs/api/13-书库/03-元数据建议.md)

**实现分层**（模块化单体，非微服务）：

```text
routes/library*.rs, collections.rs
  → 书库包 retainpdf-library 的 api.rs（backend/packages/retainpdf-library/src）
      → 书库包内部模块
```

协作说明见：

- [RUST_API_ARCHITECTURE.md](../RUST_API_ARCHITECTURE.md) §2.2–2.3
- [RUST_API_DIRECTORY_MAP.md](../RUST_API_DIRECTORY_MAP.md)
- [BOUNDARIES.md](../BOUNDARIES.md)（Library Facade）

保留这个文件是为了兼容旧链接。不要在这里维护第二份接口字段说明。
