# Python 流水线贡献指南

## 分层方向

总体分层：

```text
entrypoints -> runtime/pipeline -> services/* -> foundation
```

基本规则：

- OCR provider raw payload 必须先进入 `document_schema`，产出 `document.v1`。
- 翻译主链只消费 `document.v1` 和 translation stage spec。
- 渲染主链只消费源 PDF、translation manifest、逐页翻译 payload 和 render stage spec。
- `runtime/pipeline` 只负责编排，不吸收 provider、LLM、Typst、redaction 的细节。
- `translation` 不 import `render`，也不消费 provider raw JSON。
- `ocr_provider` 不 import `translate` 或 `render`。

更细规则见 [Python 后端架构边界](../python/architecture.md)。

## 改动规则

- 新逻辑优先放在已有分层目录，避免跨层 import。
- 翻译、渲染、OCR provider 的边界按 `docs/core/python/architecture.md` 执行。
- 新增规则类逻辑时优先补最小回归测试，尤其是公式、术语、bbox、payload 变换。
- 翻译一致性、术语表、公式保护、渲染策略应尽量通过稳定 manifest/spec 传递，不要靠跨模块读取内部临时文件。
- 渲染和 PDF 处理改动要说明是否改变输出 PDF 内容、体积、首屏预览体验或可复制文本。

## 常用检查

Python 翻译相关：

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
python3 -m compileall -q "$BACKEND_ROOT/pipeline/retainpdf_pipeline/translate"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/translation" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

Python document schema / provider 相关：

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/document_schema" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

渲染相关：

```bash
BACKEND_ROOT="$(python3 .github/scripts/resolve_backend_source.py --print-path)"
uv run --project "$BACKEND_ROOT" python -m pytest "$BACKEND_ROOT/pipeline/devtools/tests/rendering" -q
python3 "$BACKEND_ROOT/pipeline/devtools/check_pipeline_architecture.py"
```

后端源码位置由 package manifest 决定，详见[内嵌后端 Package](./backend-package.md)。

## PR 说明

涉及 Python 流水线的 PR 至少说明：

- 影响 OCR、translation、rendering 中哪一段。
- 是否改变 `document.v1`、translation manifest、render payload 或阶段事件。
- 是否影响旧 job 的重新渲染、断点恢复或诊断。
- 使用了哪些样本验证，是否包含公式、图注、脚注、长段落或大页数 PDF。
