# 后端 API 的内部设计

**对外接口用法看 [docs/api/](../../api/README.md)**：那里是唯一的对外接口说明（字段、请求响应、错误码、地址），接口目录也从接口登记表
生成到那里。这个目录只放内部设计：架构、实现思路、配置、存储、为什么这样设计。改了接口行为，改 docs/api 对应的篇；改了实现方式、
内部约定，才改这里。决定见 [接口文档以 docs/api 为准](../../ops/planning/api-reorg/20261124-接口文档以docs-api为准.md)（2026-11-24）。

- [服务总览](./overview.md)：端口、主链路、Provider
- [运行时与实现备忘](./runtime.md)：Rust 和 Python 的分工、阶段契约、模块边界、配置和环境变量、上传的处理、模型执行器内部接口、
  边翻边看的生产方要求、备份恢复的实现
- [任务查询、重试与译文修订：内部设计](./jobs-internals.md)
- [书库、凭据与术语表：内部设计](./library-internals.md)
- [事件游标 v2](./event-feed-v2.md)：事件怎么存、怎么合并来源、怎么重建和保留
- [查询改造的隔离验收](./query-acceptance.md)
- [本地启动与配置](./local-dev.md)
- [存储结构](./storage.md)
- [错误排查](./troubleshooting.md)
- [Rust API 架构边界](../rust_api/README.md)

`index.md` 以前是对外 API 总入口，现在只剩一张「原来的节 → 现在在哪」的对照表（前端代码注释还引用它的节号），不要再往里加内容。
`backend/api/docs/api-spec/` 2026-11-24 起只剩一个指向 docs/api 的 README。
