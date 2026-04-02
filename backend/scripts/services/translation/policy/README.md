# Policy 说明

`scripts/services/translation/policy/` 是翻译策略层的正式实现目录。

主要包括：

- `config.py`
  模式配置、跳过策略、领域推断入口。
- `flow.py`
  把策略真正应用到 payload 的流程入口。
- `body_text_filter.py`
  正文噪声和窄块过滤逻辑。
- `metadata_filter.py`
  作者行、版权行、编辑信息等元数据片段过滤逻辑。

## 设计原则

- 新代码统一从 `services.translation.policy.*` 导入。
- 策略层只处理 payload 级别判断，不直接碰 PDF 或渲染。
