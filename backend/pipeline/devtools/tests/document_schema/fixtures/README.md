# Document Schema Fixtures

这里放 `document_schema` 长期回归使用的最小样本。

推荐阅读顺序：

1. 先看 `backend/pipeline/retainpdf_pipeline/ocr/document_schema/README.md`
2. 再准备当前目录里的最小 fixture
3. 再去写 adapter 和 registry
4. 最后跑 `regression_check.py`

这里主要只负责 fixture 规则。
更完整的字段落位、provider 接入顺序、report 结构说明，以 `document_schema/README.md` 为准。

目标：

- 新 OCR provider 接入时，先补最小 raw fixture
- adapter 完成后，把这个 fixture 登记到 `registry.py`，再由 `regression_check.py` 自动消费
- 不要先改 translation/rendering 主线来“适配” provider 原始 JSON

当前约定：

1. 每个 provider 至少有一个最小 raw fixture
2. fixture 要尽量小，但要能稳定触发 detector
3. fixture 文件名建议带 provider 名称
4. 真正的大样本仍可引用 `output/...` 里的真实任务文件；这里优先放可提交、可长期保留的小样本

推荐最小覆盖：

- detector 可识别
- adapter 能产出合法 `document.v1`
- 至少包含 1 页
- 至少包含 1 个文本块

当前 fixture：

- `generic_flat_ocr.minimal.json`
- `paddle_complex_ocr.golden.json`
- `mineru_middle_v3.golden.json`
- `mineru_content_list_v2.golden.json`

其中 MinerU V3 fixture 模拟官方 `middle.json` 的 container → body/caption/footnote
层级，同时覆盖 abstract 正文语义、行内/行间公式、list 聚合、discarded block、
image/table asset path。它不包含真实论文内容或远程 API 响应，可以离线长期回归。

## Paddle Complex Offline Golden

`paddle_complex_ocr.golden.json` 是不联网、不调用 Paddle/LLM 的端到端回归样本。
它由 `generate_paddle_complex_ocr_golden.py` 生成，覆盖：

- 标题、章节标题与长正文
- 双栏布局和 provider reading order
- 行内公式及 provider layout bbox
- 块级公式
- 表格、表题与双向 caption relation
- 两张图片、两个图注，其中一张使用 HTML `<img>`，另一张使用标准 Markdown 图片语法
- `document.v1` 的 block id、page index、bbox、asset id，以及 Reader region / AI citation 所需的源侧定位字段

重新生成和验收：

```bash
cd backend/pipeline
python devtools/tests/document_schema/fixtures/generate_paddle_complex_ocr_golden.py
python -m pytest -q devtools/tests/document_schema/test_paddle_ocr_only_golden.py
```

测试会从 synthetic Paddle raw 走真实 OCR runner，生成并验证 raw JSON、
`document.v1.json`、normalization report、`md/full.md` 和图片资产。测试中的
provider submit/poll/download 均为内存 stub，不需要 token，也不会消耗额度。

这个离线用例有意不覆盖 Rust API 的 `/reader/regions` 响应组装、浏览器中的
PDF overlay、citation 点击滚动、高亮绘制和鉴权图片请求；这些需要独立的 API / 浏览器 E2E。

## Fixture 侧 Checklist

接入新的 OCR provider 时，这里只关心 fixture 这一侧：

1. 准备一个最小 raw fixture
   - 放到当前目录
   - 文件名带 provider 名称
   - 能稳定触发 detector

2. 把 fixture 接进 `backend/pipeline/devtools/tests/document_schema/fixtures/registry.py`
   - `name` 唯一
   - `provider` 与 adapter 注册名一致，优先引用 `backend/pipeline/retainpdf_pipeline/ocr/document_schema/providers.py` 里的共享常量
   - `document_id` 稳定可读

3. 运行 `backend/pipeline/devtools/tests/document_schema/regression_check.py`
   - 至少确认 detector、adapt、validation、extractor smoke 全通过
