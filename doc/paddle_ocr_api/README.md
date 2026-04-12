# Paddle OCR 对接文档

这套文档只服务一件事：

- 把 Paddle OCR 原始返回结果稳定收敛成 `normalized_document_v1`

不要把这里写成翻译规则文档，也不要把渲染策略塞进来。

## 对接边界

适配 Paddle OCR 的同学只负责：

1. 理解 Paddle 原始 API 和 JSON 结构
2. 实现 provider 探测与 adapter
3. 把 Paddle 私有字段映射到 `document.v1`
4. 补 fixture、回归测试和文档

明确不负责：

1. 不改翻译层 `services/translation/*`
2. 不改渲染层 `services/rendering/*`
3. 不在 `runtime/pipeline/*` 里写 Paddle 私有特判
4. 不让下游直接读取 Paddle raw JSON

## 当前代码入口

- provider 注册入口：
  `backend/scripts/services/document_schema/adapters.py`
- provider 常量：
  `backend/scripts/services/document_schema/providers.py`
- Paddle adapter 入口：
  `backend/scripts/services/document_schema/provider_adapters/paddle/adapter.py`
- Paddle page reader：
  `backend/scripts/services/document_schema/provider_adapters/paddle/page_reader.py`
- Paddle block reader：
  `backend/scripts/services/document_schema/provider_adapters/paddle/block_reader.py`
- 通用契约说明：
  `backend/scripts/services/document_schema/README.md`

## 阅读顺序

1. [00_overview.md](./00_overview.md)
2. [01_response_shape.md](./01_response_shape.md)
3. [02_field_mapping.md](./02_field_mapping.md)
4. [03_semantics_rules.md](./03_semantics_rules.md)
5. [04_continuation_hint.md](./04_continuation_hint.md)
6. [05_adapter_checklist.md](./05_adapter_checklist.md)

## 对接原则

1. Paddle 私有字段只允许留在 adapter 层和 trace 层。
2. 下游主链路只消费 `document.v1.json`。
3. 如果 Paddle 已经识别出连续段落组，写入 `continuation_hint`，不要把 `group_id` 之类的私有字段直接泄漏给 translation。
4. 先保证 schema 正确，再做语义增强；不要一上来就堆规则。
