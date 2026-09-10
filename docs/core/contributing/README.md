# 贡献文档

这里放 RetainPDF 贡献者需要的分角色指南。根目录 [CONTRIBUTING.md](../../../CONTRIBUTING.md) 是短入口，这里放细则。

## 入口

- [前端与桌面端](./frontend.md)
- [Rust API](./backend.md)
- [数据库与持久化](./database.md)
- [Python 流水线](./python-pipeline.md)
- [内嵌后端 Package](./backend-package.md)
- [测试贡献](./testing.md)
- [AI 辅助开发](./ai-development.md)
- [Issue、PR、代码风格与发布说明](./process-and-style.md)

## 读法

先读根目录贡献指南，再按自己要改的模块进入对应子文档。跨模块改动需要同时阅读相关模块文档。
涉及 HTTP 或 worker 线协议时，还必须阅读
[`backend/api/API_SPEC.md`](../../../backend/api/API_SPEC.md) 和
[`contracts/README.md`](../../../contracts/README.md)，不能只更新 prose。
