# 提示词文件

这个目录存放主链路使用的可编辑提示词文本。

- `translation_system.txt`
  翻译请求使用的 system prompt。
- `translation_task.txt`
  拼接进翻译 user payload 的任务说明。
- `classification_system.txt`
  `precise` 模式下整页分类使用的 system prompt。

如果要调模型行为，优先改这里，不要直接把提示词硬编码进 Python。
