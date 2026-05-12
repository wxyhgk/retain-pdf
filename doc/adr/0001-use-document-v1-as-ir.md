# 0001 使用 document.v1 作为 OCR 到下游的中间表示

## 背景

RetainPDF 支持 PaddleOCR、MinerU 和后续可能新增的 OCR provider。不同 provider 的原始 JSON 字段、文件结构、语义标签都不一样。如果翻译和渲染直接读取 provider raw payload，后续每接一个 provider 都会把私有字段扩散到全链路。

## 决策

OCR 阶段结束后，统一产出 `ocr/normalized/document.v1.json`。

翻译和渲染主链路只能消费 `document.v1` 的稳定字段，不直接消费 provider raw JSON。

provider raw 文件只允许保留在 provider、adapter、调试和回溯层。

## 后果

- 新 OCR provider 必须先写 adapter，把 raw payload 转成 `document.v1`。
- 翻译和渲染不能为了某个 provider 特判去读取 raw 字段。
- 如果 `document.v1` 表达能力不够，应升级 schema，而不是让下游绕过 schema。

## 替代方案

- 让翻译和渲染直接兼容每个 provider 的 raw JSON。这个方案短期快，但会让 provider 私有字段永久污染主链路。
- 每个 provider 单独维护一条完整流水线。这个方案会导致重复实现翻译、渲染和诊断能力。
