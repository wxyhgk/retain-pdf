# CLAUDE.md

给在这个仓库里工作的 Claude Code 看的约定。项目怎么跑、目录怎么分，先看
[CONTRIBUTING.md](CONTRIBUTING.md) 和 [docs/README.md](docs/README.md)；通用的 AI 开发建议在
[AI 辅助开发指南](docs/core/contributing/ai-development.md)。这里只写这些文档里没有、但每次都要守的规矩。

## 沟通

- 回复一律用简体中文；代码标识符、命令、路径照原样写。
- 提交信息用中文，前缀照 `类型(范围): 说明`，例如 `fix(translate): …`、`refactor(api): …`。
  合并提交写 `Merge branch 'xxx'：一句话说清合进来什么`。

## 分工

- 前端（`frontend/`）和后端分开做。做后端时**不改 `frontend/` 下的任何文件**，读前端代码确认调用方可以。
- 后端改动对前端只增不改：旧字段、旧地址保留，新的加在旁边。前端需要跟着改的地方，写进对应的
  后端文档或整理记录（例如 `docs/ops/planning/api-reorg/`），写清文件、旧写法、新写法。

## 分支、合并、推送

- 不直接在 `main` 上开发。每件事开一个分支，用 worktree 做，做完留着等确认。
- 用户说 **"合"** 才在本地合进 `main`；说 **"推送"** 才 push。每次确认只管那一次，不顺延到下一次。
- 推送后跑 `gh run list --limit 8`，有红的要报出来，不能当作做完。
- 改了接口行为、事件、数据库结构、产物结构，文档在**同一个分支**里一起改（`docs/api/`、`docs/core/api/`、
  `backend/api/docs/api-spec/` 等）。

## 合并前必须跑的检查

CI 的 Tests、Rust API Architecture、Publish Current Web Image 都卡在这些上，本地先跑过再合：

```bash
python3 backend/api/scripts/check_architecture.py
backend/.venv/bin/python -m pytest -q backend/api/scripts   # 架构检查等脚本自己的单测
python3 backend/pipeline/devtools/check_pipeline_architecture.py
backend/.venv/bin/python backend/pipeline/devtools/extract_pipeline_requirements.py --services-root backend --check
python3 .github/scripts/sync_backend_python_requirements.py --repo-root . --services-root backend --check
backend/.venv/bin/python -m pytest -q .github/scripts/tests   # 文档相对链接、交付和 CI 约定；改了文档也要跑
cargo test --workspace   # 和 CI 一样跑全部 Rust 包；以前列的 16 个包漏了 retainpdf-proc、retainpdf-runnerd、retainpdf-cli
```

- 改了翻译包 `backend/translation/`（或它的 worker 外壳 `backend/pipeline/retainpdf_pipeline/translate/`）：再跑
  `backend/.venv/bin/python backend/pipeline/devtools/run_translation_tests.py`，再用 `--suite translation --reverse`
  倒序跑一遍翻译单测（查模块之间互相污染）。`tests/performance` 的集成测试每个用例都在新进程里跑，顺序影响不到，
  不用倒着再跑（2026-10-30 定，以前整套倒序再跑一遍）。
  翻译的测试在 `backend/pipeline/devtools/tests/translation`，翻译包自己的冒烟测试在 `backend/translation/tests`。
  它会连带跑 `tests/performance/pipeline/tests`；提示词快照有 sha256 守卫，改提示词只重录受影响的用例。
- 改了翻译 agent 包 `backend/translation-agent/`：跑 `python -m pytest backend/translation-agent/tests`，以及测试系统的
  `backend/pipeline/devtools/tests/agent_lab`（它调这个包）。包只许用标准库，测试里钉着。
- 跑不了的检查，在回复和合并说明里写明没跑、为什么。

## 本地环境的坑

- Rust 包名统一是 `retainpdf-*`（`cargo -p` 用这个，代码里写 `retainpdf_*`），和 Python 的 `retainpdf-math`、`retainpdf-pipeline` 一样；
  `backend/packages/`、`database/` 下的目录名就是包名。应用目录 `backend/api`、`backend/cli`、`backend/jobs` 和可执行文件名
  （`rust_api`、`retain-jobsd`、`retainpdf`）没改，对照表在 `docs/core/contributing/backend.md`。
- worktree 里没有 `backend/.venv`，跑 Python 和 rust_api 测试前指向主检出的环境：
  `UV_PROJECT_ENVIRONMENT=<主检出>/backend/.venv`，`PATH=<主检出>/backend/.venv/bin:$PATH`
  （rust_api 的部分测试要用 PATH 上的 `retainpdf-pipeline`）。
- `model_executor` 的测试以前并行跑会偶发失败（测试用的超时太紧，2026-10-16 放宽了），合并前照旧再用 `--test-threads=1` 跑一遍：执行器本身的测试在 `retainpdf-providers` 包里，
  要搭整个应用的几个在 `retainpdf-api` 的 `api_tests::model_executor`。
- 不要对整个已有文件跑 rustfmt（仓库没有整体格式化过）；从 stdin 喂给 `rustfmt --check` 永远返回 0，不能当检查用。
- 本地多用户开发栈开着时，pipeline 测试收尾会报"测试污染了仓库的 data/ 目录"，是开发栈写的，CI 上不会出现。

## 接口快照与架构检查

- 三份快照钉住对外行为：接口清单 `backend/api/docs/routes.txt`、文件出口返回 `backend/api/docs/file-responses.txt`、
  建任务各入口的结果 `backend/api/docs/submissions.txt`。有意改了才重新生成：
  `UPDATE_ROUTES=1 cargo test -p retainpdf-api --lib route_manifest`、
  `UPDATE_FILE_RESPONSES=1 cargo test -p retainpdf-api --lib file_responses`、
  `UPDATE_SUBMISSIONS=1 cargo test -p retainpdf-api --lib submissions`。重新生成后看 diff，只该有预期的改动。
- 路由只在接口登记表里注册：每个路由文件是一张 `crate::endpoints!` 表（`backend/api/src/app/endpoints.rs`），一个接口一条，
  写明方法、地址、处理函数、多用户下谁能用（`public`/`signed`/`admin`/`closed`），`///` 写一句话说明，旧地址行尾写 `old "<新地址>"`。
  路由文件里直接写 `.route(` 会让测试红。接口目录 `docs/api/00-接口目录.md` 和 `docs/routes.txt` 都从表生成（`UPDATE_ROUTES=1`）。
- 加路由、加 service 前先读 `check_architecture.py` 的规则：处理函数文件（`src/routes/` 下）要 `use crate::services::…`，
  得在 `ROUTE_SERVICE_IMPORT_ALLOWLIST` 里登记这个文件和允许的路径前缀；
  新的路径参数要在账号包的 `backend/packages/retainpdf-accounts/src/access.rs` 的 `classify_param` 里归类，否则多用户模式下 403 "not cleared"。
- 改 `check_architecture.py`：任务、书库的规则写逻辑路径 `src/services/<领域>/...`，取文件用 `abs_src`，扫目录用 `scan_logical`，
  不要直接写 `SRC_ROOT / ...`；实际目录只登记在 `DOMAIN_MOUNTS`。规则里写的路径必须存在（`check_rule_paths` 会查），
  规则要求"不许存在"的路径登记在 `RULE_PATHS_MUST_NOT_EXIST`。
- `/jobs` 按 8 类分：路由 `app/router/jobs/<类>.rs`、处理函数 `routes/jobs/<类>.rs`、业务逻辑
  `services/jobs/<类>/`，三处同名。新接口放进对应的类，不要再加 `/jobs/:job_id/<名字>` 这种顶层地址；
  旧地址紧跟在新地址下面、行尾写 `old "<新地址>"`。`services/jobs/` 根目录只放各类共用的（门面、依赖、返回视图）。
  任务、书库已经拆成包，`services/jobs/...`、`services/library/...` 是逻辑路径（架构检查报错也这么写），实际在
  `backend/packages/retainpdf-jobs/src/...`、`backend/packages/retainpdf-library/src/...`。
- 建新任务只走 `services/jobs/lifecycle/creation/submit.rs` 的 `submit_job`，原地重跑已有任务走 `relaunch_in_place`；
  别处直接落库或发射任务，`check_job_entry_ownership` 会报错。
- 业务逻辑只在 8 个领域里（`accounts`、`providers`、`ingest`、`files`、`jobs`、`library`、`glossaries`、
  `platform`），新模块放进其中一个。8 个都已拆成包（2026-10-17 拆完），`services/` 下不再有目录，只有接上它们的 `mod.rs`。
  每个领域包的 `lib.rs` 是唯一的门面：子模块私有，领域外要用的东西在 `// 门面` 那一块 `pub use` 出来。
- 拆成独立包的领域（`EXTRACTED_DOMAINS`，现在有账号 `retainpdf-accounts`、文件 `retainpdf-files`、术语表 `retainpdf-glossaries`、入口 `retainpdf-ingest`、任务 `retainpdf-jobs`、书库 `retainpdf-library`、平台 `retainpdf-platform`、服务商 `retainpdf-providers`）：代码在 `backend/packages/<包>`，`lib.rs` 是门面；
  `services/mod.rs` 里 `pub(crate) use <包> as <领域>;` 接上，`services/` 下不再留它的目录。
  只给 rust_api 测试用的导出，在包里挂在 `test-fixtures` 特性下（`#[cfg(any(test, feature = "test-fixtures"))]`），
  rust_api 的 `[dev-dependencies]` 打开它；`#[cfg(test)]` 跨包看不到。
- 领域之间只能往下依赖，允许的方向登记在 `ALLOWED_DOMAIN_DEPENDENCIES`，也不许有环；两边都要用的东西往下放。
  按编号读出任务（`job_loading`）和错误类型（`AppError`）在单独的包 `retainpdf-api-base` 里，services 下面一层；
  rust_api 里照旧写 `crate::error`（`job_loading` 只有领域包用，写 `retainpdf_api_base::job_loading`）。
  只给测试用的小工具（找项目 Python 环境的 `project_venv_bin`、最小 PDF `minimal_pdf_bytes`）也在底座包，挂在 `test-fixtures` 下。
- 接口的请求、返回类型放在它所属的领域包里（任务的在 `retainpdf-jobs` 的 `views/`，书库、术语表、文件链接、上传、备份各在自己的包），
  在 rust_api 的 `backend/api/src/models.rs` 里并进 `models::api`，路由照旧写 `crate::models::api::…`。核心包只放库里存的记录
  （任务、上传、文档、术语表、事件）和各领域都要用的小工具，不再加返回类型。
- 读任务请求里的东西用 retainpdf-core `models/job/questions.rs` 的方法（`job.source_job_id()`、`job.uses_model_executor()`……），
  不要一路点进 `job.request_payload.<字段>`；只有 `KNOWN_REQUEST_PAYLOAD_WRITERS` 里生成、改写请求的模块可以，名单只许减不许加。
- 产物文件路径只许出口模块拼（`services/jobs/files/downloads`、`services/jobs/reader/markdown.rs`、`services/library/media.rs`，以及文件包
  `retainpdf-files` 的 `src/artifacts`、`src/derived_artifacts`）。别处要读已经落盘的产物（规范化文档、翻译清单、译文 PDF……），
  调任务包的 `stored_path(任务, data_root, StoredFile::…)`，不要直接调 `storage_paths::resolve_*`；冻结名单 `KNOWN_ARTIFACT_PATH_READERS` 已清空，不许再加。

## 记录

- **开发记录**：`docs/ops/devlog/YYYY-MM.csv`，一行一件事，每个分支合并前加一行，推送后改状态。
  列和取值见 [docs/ops/devlog/README.md](docs/ops/devlog/README.md)，`python3 ops/development/check_devlog.py` 检查格式。
- **方案和决定**：按主题放在 `docs/ops/planning/<主题>/`，文件名 `YYYYMMDD-主题.md`。
  新决定写新文件，不改写旧文件；目录的 README 列出所有文件。
- 已有的 CSV 台账（`docs/ops/planning/*.csv`）只追加，不覆盖旧行。

## 安全

- 不提交、不打印密钥和 token；用户贴进来的密钥不要写进文件或平台设置，提醒用户作废重发。
- 不提交真实用户文件、`data/` 下的数据库和任务目录、`tmp/`、大体积实验输出。
- 用户的邮箱等个人信息不发给外部服务。
