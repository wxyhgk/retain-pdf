# Retain 对接建议

基于当前 `doc/reference/LLM_api/DeepSeek` 目录文档，以及官方最新模型口径，当前项目最值得直接利用的能力如下。

## 1. 默认模型

- 默认模型应切到 `deepseek-v4-flash`
- `deepseek-chat` / `deepseek-reasoner` 目前仍兼容，但官方文档已标注后续弃用，不应再作为新默认值

## 2. 当前项目最直接有用的能力

- `JSON Output`
  适合我们当前翻译分类、失败诊断、结构化返回场景
- `1M context`
  有利于长文档、长上下文规则和术语表场景
- `Context Cache / KV Cache`
  对重复 system prompt、长规则、长术语表的批量翻译成本优化价值很高
- `Tool Calls`
  目前主流程不是必须，但对失败诊断、规则选择、外部术语查询有潜在价值
- `错误码`
  401 / 402 / 422 / 429 / 500 / 503 值得映射进我们现有失败分类与重试策略

## 3. 对后端最建议优先做的事情

- 统一默认模型为 `deepseek-v4-flash`
- 保留 `response_format={\"type\":\"json_object\"}` 的结构化返回能力
- 在 DeepSeek 429 / 503 上继续强化重试与退避
- 评估把长 system prompt、规则文本、术语表接入 context cache
- 不要再把 `deepseek-chat` 写进新的示例、默认值和调试工具

## 4. 相关文档

- [模型 & 价格](./模型%20%26%20价格.md)
- [JSON_output](./JSON_output.md)
- [Tool Calls](./Tool%20Calls.md)
- [错误码](./错误码.md)
- [Token 用量计算](./Token%20用量计算.md)
