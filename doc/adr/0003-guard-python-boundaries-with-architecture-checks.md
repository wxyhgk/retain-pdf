# 0003 用架构检查守住 Python 模块边界

## 背景

随着 OCR、翻译、渲染、桌面端和 Rust API 持续增长，单纯靠人工记忆无法长期维护模块边界。文件数量本身不是问题，真正的问题是跨层 import、循环依赖和 provider 私有字段泄漏。

## 决策

短期先使用仓库已有的 `backend/scripts/devtools/check_pipeline_architecture.py` 固化 Python 后端核心边界，并接入 CI。

长期可以评估引入 `tach`、`import-linter` 或 `grimp`，但不会在没有收益验证前增加新依赖。

当前必须守住的方向：

- `runtime/pipeline` 只编排，不直接依赖 provider raw、translation internals、rendering internals。
- `translation` 和 `rendering` 不消费 provider raw JSON。
- `typst` 不反向 import `redaction`。
- `layout` 不 import `source_pdf`、`typst`、`redaction`。
- `ocr_provider` 不依赖 translation/rendering。

## 后果

- 结构性违规会在架构检查中失败。
- 新模块要么放进现有边界，要么先更新架构文档和检查规则。
- 不是所有边界都一次性卡死，先卡最容易腐化的关键方向。

## 替代方案

- 只写 README 靠约定。这个方案执行成本低，但长期会失效。
- 立刻引入完整第三方依赖治理工具。这个方案更系统，但需要先评估配置成本和 CI 稳定性。
