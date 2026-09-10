# 测试贡献指南

测试贡献和代码贡献同等重要。专业测试人员不需要先理解全部内部实现，也可以直接贡献高价值工作。

## 可以贡献什么

- 可公开或已脱敏的 PDF 样本，以及对应的期望现象、页码、bbox、截图和 job_id。
- OCR 归一化、翻译、公式保护、渲染、下载、reader、library、resume 的回归用例。
- 大样本性能基准，例如 100 页、500 页、1000 页 PDF 的阶段耗时、内存占用和输出体积。
- 端到端验收清单，例如桌面端首次启动、Docker 升级、断网重试、token 错误、任务取消、重新渲染、批量删除。
- 手工测试报告，包含环境、版本、复现步骤、期望结果、实际结果和附件。
- 自动化测试脚本或 fixture，但必须保证不包含私有 token、真实用户文件或不可公开内容。

## 测试 Issue 建议格式

```md
## 环境

- RetainPDF 版本：
- 运行方式：桌面端 / Docker / 本地开发
- 系统和浏览器：
- OCR provider：
- 模型 provider：

## 样本

- 是否可公开：
- 页数：
- 相关页码 / bbox：
- job_id：

## 步骤

1. ...
2. ...

## 期望结果

...

## 实际结果

...

## 附件

- 截图 / 脱敏 PDF / 日志 / 事件流片段
```

## 测试 PR 建议

- fixture 尽量小，能用 1 到 3 页复现就不要提交整本书。
- 大文件、批量 PDF、benchmark 输出默认放 `experiments/` 或外部链接；只有明确需要进入自动化测试的小样本才提交仓库。
- 新增测试时说明它保护的 bug、模块或用户流程。
- 对性能测试，写清楚机器环境、样本页数、命令、旧耗时、新耗时和允许波动范围。
- 对视觉/渲染问题，尽量附页码、bbox、截图和期望行为；只说“看起来不对”很难形成回归测试。

## 常用测试入口

Rust API：

```bash
npm run test:api
```

Python：

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/translation" -q
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/document_schema" -q
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/rendering" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

前端与桌面端：

```bash
npm --prefix frontend/web test
npm --prefix frontend/web run build
npm --prefix frontend/desktop run verify-frontend-sync
```

`npm --prefix frontend/web test` 使用 Node 原生 test runner，优先覆盖任务进度、状态整形等不依赖浏览器和后端服务的纯函数回归。

前端端到端状态 smoke 会真实提交任务，通常需要本地 Rust API、OCR token、模型 key 和样本 PDF；具备这些条件时再跑：

```bash
cd frontend/web
npm run smoke:status -- --file ../data/temPDF/test1.pdf
```
