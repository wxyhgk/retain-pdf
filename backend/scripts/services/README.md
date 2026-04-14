# Services 说明

`scripts/services/` 是具体能力实现层。

这里放真正执行工作的模块，而不是流程编排：

- `ocr_provider/`
  OCR provider API 接入层的独立约定。这里只定义“第三方 OCR 服务怎么接进来”，不把 provider API 细节耦合到翻译/渲染工作流。
- `document_schema/`
  统一中间文档结构版本定义、adapter registry、defaults 收口、schema 校验与 normalization report。
- `mineru/`
  MinerU 这个 provider 的具体实现：提交、轮询、下载、解包、任务产物整理。
- `translation/`
  OCR 解析、翻译编排元数据、策略过滤、LLM 调用、结果回填。
- `rendering/`
  PDF 擦除、背景处理、Typst 生成、公式规整、最终渲染与压缩。

设计原则：

- `services/*` 负责把单项能力做完整
- `ocr_provider/` 只定义 provider 接入约定，不承担具体 provider 实现
- `document_schema/` 负责定义统一中间层，不承载 provider 细节
- OCR provider 原始 JSON 必须先经过 `document_schema/adapters.py` 转成 `document.v1`
- 需要排查 raw -> normalized 转化时，优先看 `document.v1.report.json` 或 `validate_document_schema.py --adapt`
- 如果只是消费 provider / defaults / validation 摘要，优先走 `document_schema/reporting.py`
- `mineru/` 是一个 provider 实现，不是 OCR 总工作流本身
- `translation/ocr` 主线优先读取 normalized document，而不是直接依赖某个 OCR provider 的原始 JSON
- `runtime/pipeline` 只负责把这些能力串起来
- 上层入口优先依赖 `runtime/pipeline`，不要直接跨服务拼流程
- 公共配置和共享工具继续下沉到 `foundation/`

## 新 OCR Provider 最短路径

新 provider 接入时，推荐最短路径是：

1. 先读 `ocr_provider/README.md`
2. 再读 `document_schema/README.md`
3. 准备最小 raw fixture
4. 写 provider API 接入层和 adapter
5. 把 fixture 加到 `devtools/tests/document_schema/fixtures/registry.py`
6. 跑 `devtools/tests/document_schema/regression_check.py`

只有这条链跑通后，provider 才应该进入 translation/rendering 主线。

## 协作规矩

现在可以按模块拆分负责人，但边界必须按协议来守：

- OCR / provider 负责人主要维护 `ocr_provider/`、`mineru/`、`document_schema/`
- 翻译负责人主要维护 `translation/`
- 渲染负责人主要维护 `rendering/`
- 编排负责人主要维护 `runtime/pipeline/`

默认原则：

- 每个负责人优先在自己模块内解决问题，不把临时特判扩散到别的模块
- `document.v1.json`、`translation-manifest.json`、render-only 输入协议属于稳定交接点，不能单边修改
- 如果必须改交接协议，必须同时更新上下游 README、调用入口、兼容逻辑和测试
- translation / rendering 主线禁止重新依赖 provider raw JSON
- pipeline 只负责编排，不负责吸收 provider 特判、翻译细节或渲染补丁
