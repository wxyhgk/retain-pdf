# 贡献指南

感谢你愿意参与 RetainPDF。这个项目包含 Rust API、数据库、Python OCR/翻译/渲染流水线、静态前端、桌面端和 Docker 交付。贡献时最重要的是：边界清楚、改动可验证、问题可复现。

## 贡献方向

- 前端与桌面端：任务状态、对照阅读、术语表 UI、下载体验和 Electron bundle 同步。
- Rust API：任务管理、图书馆接口、产物下载、事件流、reader、断点恢复和权限边界。
- 数据库与持久化：job/artifact/event/glossary 记录、schema 兼容、旧数据恢复和存储路径。
- Python 流水线：OCR 归一化、翻译一致性、公式保护、渲染、PDF 处理和失败诊断。
- 专业测试：真实样本回归、边界用例、fixture、自动化脚本、性能基准和验收清单。
- AI 辅助开发：推荐使用 Codex 或 Claude Code，按项目边界拆任务、生成测试、做代码审查和文档更新。
- Docker、CI、文档和维护者发布流程。

## 子文档

- [前端与桌面端贡献指南](docs/core/contributing/frontend.md)
- [Rust API 贡献指南](docs/core/contributing/backend.md)
- [数据库与持久化贡献指南](docs/core/contributing/database.md)
- [Python 流水线贡献指南](docs/core/contributing/python-pipeline.md)
- [内嵌后端 Package](docs/core/contributing/backend-package.md)
- [测试贡献指南](docs/core/contributing/testing.md)
- [AI 辅助开发指南](docs/core/contributing/ai-development.md)
- [Issue、PR、代码风格与发布说明](docs/core/contributing/process-and-style.md)

建议同时阅读：

- [README](README.md)
- [本地启动与配置](docs/core/api/local-dev.md)
- [运行时存储结构](docs/core/api/storage.md)
- [主线文档](docs/core/README.md)

## 本地最小启动

后端：

```bash
python3 ops/development/dev_stack.py --runtime python
```

该入口准备 `backend/.venv` 与 Rust binaries，并以
`remote + supervised` 模式启动 `rust_api`、`retain-jobsd` 和
`retainpdf-ai`。已经准备好的 checkout 可追加 `--no-sync --no-build`。

前端：

```bash
npm ci
npm run build:web
python3 -m http.server 40001 --bind 0.0.0.0 --directory frontend/web
```

所有正式 JavaScript workspace 共用根目录的 `package-lock.json`。不要在
`frontend/*` 或 `frontend/packages/*` 内运行会生成子锁文件的独立安装；新增或更新依赖时，
从仓库根目录运行 npm。

默认端口：

- Rust API：`41000`
- `/api/v1/translate/bundle` multipart 提交入口：`42000`
- Web 前端：`40001`

本地 launcher 还使用两个仅供后端内部通信的回环端口：
`retain-jobsd` 为 `41002`，`retainpdf-ai` 为 `41100`。

Docker 交付也默认使用同一组端口。如果本机已经启动 Docker Web，本地静态前端可以临时换成其他未占用端口；换端口只影响浏览器访问入口，不改变 Rust API 默认端口。

## 提交前最低要求

- 说明改了什么、为什么改、影响哪些模块。
- 根据改动范围跑对应测试或检查。
- 如果有检查没跑，在 PR 描述里说明原因。
- 不提交本地密钥、token、真实用户文件、`data/db/jobs.db`、`data/jobs/*`、`tmp/*` 或大体积实验输出。
- 改动 API、事件、数据库 schema、产物结构、模块边界或部署方式时，同步更新文档。

## 目录放置规则

- 应用入口进入 `frontend/`，前端共享库进入 `frontend/packages/`；后端服务进入 `backend/`，后端共享库进入 `backend/packages/`。
- 跨端协议进入 `contracts/`，数据层代码进入 `database/`，项目级测试进入 `tests/`。
- 开发、部署与发布工具进入 `ops/`，安全规范与检查进入 `security/`，正式文档统一进入 `docs/`。
- 模块脚本跟随所有者放置，例如 `frontend/web/scripts/`、`backend/api/scripts/`；
  仓库级 CI 工具进入 `.github/scripts/`。
- 不要重新创建根目录 `apps/`、`packages/`、`services/`、`doc/`、`scripts/` 或 `src/` 作为源码入口。
- `data/` 与 `tmp/` 只保存本地运行和诊断数据，不能作为代码或文档入口。

维护者发布、Docker 交付和线上运维流程不放在普通贡献者主线里，相关记录见 [运维与过程记录](docs/ops/README.md) 和 Docker 文档。
