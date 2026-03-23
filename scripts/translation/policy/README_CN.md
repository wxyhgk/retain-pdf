# policy 说明

`scripts/translation/policy/` 是翻译策略层的正式实现目录。

它把原来散落在 `scripts/translation/` 根目录下的策略相关代码收拢到一起，主要包括：

- `config.py`
  模式配置、跳过策略、领域推断入口。
- `flow.py`
  把策略真正应用到 payload 的流程入口。
- `body_text_filter.py`
  正文噪声和窄块过滤逻辑。
- `metadata_filter.py`
  作者行、版权行、编辑信息等元数据片段过滤逻辑。

## 设计原则

- 新代码统一从 `translation.policy.*` 导入。
- 策略层只处理 payload 级别的判断，不直接碰 PDF 或渲染。

## 主要接口

- `TranslationPolicyConfig`
  策略开关和上下文配置。
- `build_translation_policy_config(...)`
  从运行参数构建单页策略配置。
- `build_book_translation_policy_config(...)`
  从整本 PDF 和 MinerU/OCR 结果构建策略配置。
- `apply_translation_policies(...)`
  把策略实际写回 payload。
