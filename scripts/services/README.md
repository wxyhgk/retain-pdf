# Services 说明

`scripts/services/` 是具体能力实现层。

这里放真正执行工作的模块，而不是流程编排：

- `document_schema/`
  统一中间文档结构版本定义。
- `mineru/`
  MinerU 提交、轮询、下载、解包、任务产物整理。
- `translation/`
  OCR 解析、翻译编排元数据、策略过滤、LLM 调用、结果回填。
- `rendering/`
  PDF 擦除、背景处理、Typst 生成、公式规整、最终渲染与压缩。

设计原则：

- `services/*` 负责把单项能力做完整
- `document_schema/` 负责定义统一中间层，不承载 provider 细节
- `mineru/` 负责 provider 接入与 raw -> normalized 适配，不把 provider 原始结构泄漏到主链路
- `translation/ocr` 主线优先读取 normalized document，而不是直接依赖某个 OCR provider 的原始 JSON
- `runtime/pipeline` 只负责把这些能力串起来
- 上层入口优先依赖 `runtime/pipeline`，不要直接跨服务拼流程
- 公共配置和共享工具继续下沉到 `foundation/`
