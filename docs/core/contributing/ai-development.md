# AI 辅助开发指南

RetainPDF 鼓励使用 AI 辅助开发。推荐优先使用 Codex 或 Claude Code 这类能读写本地仓库、运行命令、执行测试的 coding agent，而不是只在聊天窗口里让模型凭空给方案。

AI 可以提高效率，但不能替代边界判断、测试验证和最终责任。提交 PR 的人需要确认改动符合项目架构、通过必要检查，并能解释风险。

## 推荐工具

- Codex：适合在本地仓库中做代码修改、重构、测试、文档整理和发布前检查。
- Claude Code：适合长上下文代码阅读、跨文件重构、生成测试和总结复杂改动。

不要求贡献者必须使用某一个工具，但如果使用 AI 参与开发，建议在 PR 描述中简单说明 AI 参与了哪些环节，例如“辅助生成测试”“辅助整理文档”“辅助重构 import 边界”。

## 建议的 AI Skills

可以把下面这些能力写成 Codex skill、Claude Code command，或项目内的 agent checklist。

### RetainPDF 项目上下文

用途：让 AI 先理解仓库边界再动手。

应包含：

- 项目根目录：当前产品仓库根目录，不写死本机绝对路径。
- 后端源码：先运行 `.github/scripts/resolve_backend_source.py --json`，解析当前产品 commit 内的自包含 package。
- 主要后端模块：`api/`、`ai/`、`pipeline/`、`contracts/`、`docker/`；产品集成位于 `.github/`、`ops/deployment/docker/` 和 `backend-package.json`。
- Rust workspace：`api` 是 HTTP composition root，稳定边界位于
  `api/crates/retain-core`、`retain-data`、`retain-jobs`、`retain-proc` 和
  `retain-jobsd`，不要把这些职责重新合并进 `rust_api/src`。
- 核心规则：不要回滚无关脏改；手动编辑用 patch；改前先读相邻代码；按模块跑测试。
- 文档入口：根目录 `CONTRIBUTING.md` 和 `docs/core/contributing/README.md`

### Rust API 边界检查

用途：防止 AI 把 route、service、runner、db 混在一起。

应提醒 AI：

- `src/app/router/*` 只装配路由，`src/routes/*` 只做 HTTP adapter。
- `src/services/*` 做应用用例、facade 和安全 view/projection。
- `crates/retain-jobs/src/job_runner/*` 做运行态执行；通用进程控制留在 `retain-proc`。
- 数据库访问通过 `retain-data::Db` facade 和领域子模块，不在 route/service 里直接写 SQL。
- 新 API 字段要同步分领域 API 文档、双镜像 JSON Schema 和 producer/consumer 契约测试。

常用检查：

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
cargo fmt --manifest-path "$BACKEND_ROOT/api/Cargo.toml" --check
cargo test --locked --workspace --manifest-path "$BACKEND_ROOT/api/Cargo.toml"
python3 "$BACKEND_ROOT/api/scripts/check_architecture.py"
```

### Python 流水线边界检查

用途：防止 AI 引入跨层 import 或绕过稳定 manifest。

应提醒 AI：

- OCR raw payload 先进入 `document_schema`，产出 `document.v1`。
- translation 不 import rendering。
- rendering 只消费源 PDF、translation manifest、逐页 payload 和 render spec。
- 新增公式、术语、bbox、渲染策略时补最小回归测试。

常用检查：

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/translation" -q
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/rendering" -q
```

### 前端与桌面端同步

用途：防止 AI 只改网页源码，忘记桌面端 bundle。

应提醒 AI：

- 改 `frontend/web/**` 后需要跑 `npm --prefix frontend/desktop run verify-frontend-sync`。
- 不要只改 `frontend/desktop/app/frontend/**`。
- `frontend/web-react/` 是迁移区，不默认替代 `frontend/web/`。
- 本地静态前端默认端口是 `40001`。

常用检查：

```bash
npm --prefix frontend/web run build
npm --prefix frontend/desktop run verify-frontend-sync
```

### 测试与回归生成

用途：让 AI 帮专业测试人员把问题转成可复现用例。

应提醒 AI 输出：

- 环境、版本、provider、workflow。
- 样本是否可公开。
- 页码、bbox、截图、job_id。
- 复现步骤、期望结果、实际结果。
- 最小 fixture 或自动化测试建议。

### 文档一致性检查

用途：避免改代码后文档落后。

应提醒 AI 检查：

- API 字段是否同步 `docs/core/api/`。
- Rust 边界是否同步 `docs/core/rust_api/`。
- 实现契约是否同步 `backend/api/docs/api-spec/`，共享 schema 是否保持
  `backend/contracts` 与 `contracts` 字节一致。
- Python 边界是否同步 `docs/core/python/`。
- 前端、Docker、桌面端端口和命令是否一致。
- 根目录 `CONTRIBUTING.md` 是否仍然只是短入口。

## 推荐工作流

1. 让 AI 先读相关子文档，不要直接改代码。
2. 要求 AI 给出影响范围和验证计划。
3. 让 AI 小步提交 patch，不做无关格式化。
4. 跑对应测试或检查。
5. 让 AI 做一次 review：重点查跨层依赖、旧兼容、测试缺口、文档缺口。
6. 人工确认输出、风险和 PR 描述。

## 提示词建议

可以直接对 Codex 或 Claude Code 这样说：

```text
你在 RetainPDF 仓库中工作。先阅读 CONTRIBUTING.md 和相关 docs/core/contributing 子文档。
只修改本任务相关文件，不要回滚无关脏改。
改动前说明影响范围，改动后运行对应测试。
如果不能运行测试，说明原因和剩余风险。
```

针对后端：

```text
检查这次 Rust API 改动是否违反 routes -> services -> job_runner/db 的边界。
重点看 route 是否拼业务 JSON、service 是否直接依赖 HTTP Response、job_runner 是否反向依赖 service。
给出文件和行号，必要时直接修复。
```

针对 Python：

```text
检查 translation、rendering、ocr_provider 是否存在跨层 import。
不要让 translation import render。
如果需要共享数据，通过 manifest/spec/document.v1 传递。
```

针对测试：

```text
把这个 bug 报告整理成可复现测试用例。
需要包含环境、样本、页码、bbox、复现步骤、期望结果、实际结果，以及建议自动化测试落点。
```

## 注意事项

- AI 生成的代码必须经过人工 review。
- AI 不应提交真实用户文件、私有 token、本地数据库或大体积运行产物。
- AI 做重构时必须说明替代了哪些重复或耦合，不能为了“看起来更通用”新增抽象。
- AI 修改发布、Docker、桌面端打包流程时，要额外说明回滚方式和验证方式。
