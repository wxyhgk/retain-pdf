"""普通翻译引擎 retainpdf-translation-classic（2026-11-20 拆包第 2 步，从 retainpdf_translation 搬来）。

批量逐块翻、乱码重构、修复兜底、空译收口、译前准备、精修、编辑部、表格翻译、任务记忆。目录结构和原来一样
（`workflow/book_flow.py`、`llm/shared/orchestration/`……），依赖底座 retainpdf_translation，底座不依赖它：
底座经引擎登记表 `retainpdf_translation.workflow.engines` 按「模块:函数」字符串延迟加载。提示词留在底座的 prompts/
（断点指纹要读），这里照旧用底座的 prompt_loader 取。
"""
