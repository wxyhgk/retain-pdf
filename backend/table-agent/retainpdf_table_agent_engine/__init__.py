"""表格 agent 的接线：接翻译底座的模型调用（同一套重试、协议、Rust 执行器开关、用量台账）、原表截图。

装 ``retainpdf-table-agent[engine]`` 才有它的依赖；只用核心的不用装。
"""
from retainpdf_table_agent_engine.llm import REQUEST_LABEL
from retainpdf_table_agent_engine.llm import STRUCTURE_REQUEST_LABEL
from retainpdf_table_agent_engine.llm import table_chat_fn
from retainpdf_table_agent_engine.screenshot import table_screenshot
from retainpdf_table_agent_engine.screenshot import table_screenshot_part

__all__ = ["REQUEST_LABEL", "STRUCTURE_REQUEST_LABEL", "table_chat_fn", "table_screenshot", "table_screenshot_part"]
