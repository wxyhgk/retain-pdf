# Rust API Spec（入口已迁走）

2026-11-24 起接口文档以 `docs/api/` 为准，这里不再写接口内容
（决定见 [接口文档以 docs/api 为准](../../docs/ops/planning/api-reorg/20261124-接口文档以docs-api为准.md)）：

- **对外接口用法**（信封、认证、错误码、各接口的请求响应）：[docs/api/](../../docs/api/README.md)，
  全部接口见 [接口目录](../../docs/api/00-接口目录.md)（从接口登记表 `src/app/endpoints.rs` 和各路由表生成）。
- **内部设计**（Rust/Python 分工、配置、存储、事件、实现备忘）：[docs/core/api/](../../docs/core/api/README.md)。
- 原来按领域拆的 `docs/api-spec/*.md` 已清空，只剩一个 [README](docs/api-spec/README.md)。

这个文件留着，是因为 `scripts/check_architecture.py` 的 `check_protocol_docs` 会读它，检查里面不出现已经过时的协议写法。

## 后端的其它文档

- [Service documentation index](README.md)
- [Current runtime API map](CURRENT_API_MAP.md)
- [Rust API architecture](RUST_API_ARCHITECTURE.md)
- [Stage execution contract](STAGE_EXECUTION_CONTRACT.md)
- [OCR provider contract](OCR_PROVIDER_CONTRACT.md)
- [Render options contract](RENDER_OPTIONS_CONTRACT.md)
- [Rust API directory map](RUST_API_DIRECTORY_MAP.md)

## 写接口文档的规矩

- 路由以接口登记表为准（`src/app/router/*.rs` 里的 `endpoints!` 表，生成到 `docs/api/00-接口目录.md`）；文档里的接口清单只是导航，
  不代表另有或计划中的接口。
- 一条跨领域的规则只在一个地方写，别处链过去，不要抄。
- 挪文档时对外的 HTTP 地址和 schema 标识不变。
- 改 worker / 阶段的数据结构，要同时改 schema 和生产方、消费方的契约测试；只改文档不改变协议。
- 示例里不写密钥、运行时绝对路径、签名地址、服务商原始请求体。
