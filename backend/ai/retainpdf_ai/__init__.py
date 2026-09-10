"""retainpdf-ai:常驻 AI 服务(agentic 检索问答)。

架构定位:Rust API 是数据面唯一写入者(documents/favorites/FTS);
本服务无状态,推理循环 + 工具注册表,工具经 Rust API 读数据、
直读任务目录产物取块文本。翻译批处理 worker 与本服务互不相干。
"""

__version__ = "0.1.0"
