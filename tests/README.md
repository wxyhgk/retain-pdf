# 项目测试入口

从仓库根运行。模块单元测试保留在模块内部；本目录管理跨模块 E2E、性能
工具及固定输入。下面的默认检查不调用付费模型。

| 范围 | 命令 |
| --- | --- |
| 网页 | `npm run test:web` |
| 桌面 | `npm run verify:desktop` |
| Rust 全工作区（含数据库） | `npm run test:api` |
| 翻译离线 | `npm run test:translation` |
| 翻译逆序 | `python3 backend/pipeline/devtools/run_translation_tests.py --reverse` |
| AI | `uv run --project backend --extra test python -m pytest backend/ai/tests -q` |
| 上游协议 | `npm test --workspace=@retainpdf/contracts` |
| 协议镜像 | `python3 backend/contracts/check_parity.py --require-upstream` |
| CI 与目录契约 | `python3 -m pytest .github/scripts/tests -q` |
| 运维工具 | `python3 -m pytest ops/development/tests ops/release/tests -q` |
| 性能工具离线测试 | `python3 -m pytest tests/performance/pipeline/tests -q` |
| Agent E2E 工具离线测试 | `python3 -m pytest tests/e2e/agent/tests -q` |

Python 命令需要已安装测试依赖的解释器；推荐先执行
`uv sync --project backend --extra test --locked` 并使用对应环境。
运行 Rust 的真实流水线集成测试时，需要该环境的 `retainpdf-pipeline` 在 PATH 中。

真实供应商测试、远程 Windows 测试和发布不属于这些默认检查，必须单独指定。
`fixtures/` 是版本化输入，不能存放凭据、用户文件或新的运行输出。
