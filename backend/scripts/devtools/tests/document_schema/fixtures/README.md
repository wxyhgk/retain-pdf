# Document Schema Fixtures

这里放 `document_schema` 长期回归使用的最小样本。

推荐阅读顺序：

1. 先看 `scripts/services/document_schema/README.md`
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

## Fixture 侧 Checklist

接入新的 OCR provider 时，这里只关心 fixture 这一侧：

1. 准备一个最小 raw fixture
   - 放到当前目录
   - 文件名带 provider 名称
   - 能稳定触发 detector

2. 把 fixture 接进 `scripts/devtools/tests/document_schema/fixtures/registry.py`
   - `name` 唯一
   - `provider` 与 adapter 注册名一致，优先引用 `services/document_schema/providers.py` 里的共享常量
   - `document_id` 稳定可读

3. 运行 `scripts/devtools/tests/document_schema/regression_check.py`
   - 至少确认 detector、adapt、validation、extractor smoke 全通过
