# 项目测试入口

从仓库根运行。模块单元测试保留在模块内部；本目录管理性能
工具及固定输入。下面的默认检查不调用付费模型。

「CI」一列对应 `.github/workflows/` 里的步骤（未注明文件的都在 `tests.yml`）；标「否」的只能手动跑，
改动相关代码时要自己记得跑一遍。

| 范围 | 命令 | CI |
| --- | --- | --- |
| 网页 | `npm run test:web` | 是（Frontend Tests） |
| 桌面 | `npm run verify:desktop` | 是（`desktop-frontend-sync.yml`；`tests.yml` 只跑 `test:desktop`） |
| Rust 全工作区（含数据库） | `npm run test:api` | 是（Cargo Workspace Tests） |
| 翻译离线（含本目录 `performance/pipeline/tests`） | `npm run test:translation` | 是（Offline translation regression） |
| 翻译逆序 | `python3 backend/pipeline/devtools/run_translation_tests.py --reverse` | 否 |
| 上游协议 | `npm test --workspace=@retainpdf/contracts` | 是（Test and build @retainpdf/contracts） |
| 协议镜像 | `python3 backend/contracts/check_parity.py --require-upstream` | 是（Check backend contract mirror parity） |
| CI 与目录契约 | `python3 -m pytest .github/scripts/tests -q` | 是（Test backend source resolver） |
| 运维工具 | `python3 -m pytest ops/development/tests ops/release/tests -q` | 是（Test ops tooling） |
| 性能工具离线测试 | `python3 backend/pipeline/devtools/run_translation_tests.py --suite benchmarks` | 是（随「翻译离线」一起跑） |

Python 命令需要已安装测试依赖的解释器；推荐先执行
`uv sync --project backend --extra test --locked` 并使用对应环境。
运行 Rust 的真实流水线集成测试时，需要该环境的 `retainpdf-pipeline` 在 PATH 中。

性能工具测试要走 `run_translation_tests.py`：它清理供应商环境变量并隔离输出目录。
直接 `pytest tests/performance/pipeline/tests` 只适合聚焦调试；也不要把它和别的
测试目录放进同一次 pytest——它的 conftest 在 `pytest_configure` 里全局阻断网络，
同进程里起 loopback 服务的用例会跟着失败。

## 目录

- `e2e/agent/`（已删）：AI 助手的 agent 端到端工具，2026-11-03 跟 RetainPDF 自己的 AI 服务一起删了。
- `performance/pipeline/`：测速入口与离线对比工具，详见该目录 README。
- `fixtures/golden-jobs/`：已脱敏的真实任务快照。Rust（`api_tests/golden_replay.rs`、
  `retainpdf-data` 的 stage spec 契约）、`backend/pipeline/devtools/tests` 和
  `ops/release/check_standalone.py` 都直接读它，改动前先看它自己的 README。
- `fixtures/pdfs/`：真实 PDF 回归样本，只被手动脚本（`run_golden_flow.py`、
  渲染速度基准、`golden_harness.py` 的源 PDF 兜底）使用，没有自动化测试读取。
  新增样本必须同时登记到 `manifest.csv`，否则没有任何入口会用到它。

真实供应商测试、远程 Windows 测试和发布不属于这些默认检查，必须单独指定。
`fixtures/` 是版本化输入，不能存放凭据、用户文件或新的运行输出。
