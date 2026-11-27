"""`python -m retainpdf_ask_agent`：后端的 ACP 桥起的自带 agent（stdio）。

模型配置和密钥由桥经环境变量给（`RETAIN_ASK_MODEL`、`RETAIN_ASK_BASE_URL`、`RETAIN_ASK_API_PROTOCOL`、`RETAIN_ASK_THINKING`、
`RETAIN_ASK_API_KEY`）。握手带了书（`job_id`）时桥再给读书用的：`RETAIN_ASK_JOB_ID`、`RETAIN_ASK_DOCUMENT_ID`、
`RETAIN_ASK_BACKEND_URL`（后端自己的回环地址）、`RETAIN_ASK_BACKEND_KEY`（读书用的密钥），有了就给模型读书的工具（`tools.py`）。
记忆（2026-11-26，`memory.py`）：有后端地址和密钥就给 `remember` / `search_memories`（不要书）；握手带了对话时桥另给
`RETAIN_ASK_CONVERSATION_ID`，开会话时从后端取记忆和最近几轮。
互动块（`openui.py`）：桥给 `RETAIN_OPENUI_PROMPT`、`RETAIN_OPENUI_LIBRARY`、`RETAIN_OPENUI_CHECK`、`RETAIN_OPENUI_NODE`，
说明文件读得到就开（系统提示词带 L0，多两个工具），读不到照常回答。
stdout 只写协议消息：别的模块的 print 一律改到 stderr。
`python -m retainpdf_ask_agent summarize`（2026-11-26 第二期，`summarize.py`）：一次性压一段对话，stdin 一个 JSON、stdout 一行 JSON，
模型配置同上（压缩用户设置里那条模型；书、记忆、互动块都不要）。
这是接线的入口，要 import 接线包（核心其余文件只用标准库，测试里单独放过这个文件）。
"""
from __future__ import annotations

import os
import sys

# 上下文窗口（ACP usage_update 的 size）；没给就按协议估个常见值
DEFAULT_CONTEXT_WINDOW = {"anthropic": 200_000}
FALLBACK_CONTEXT_WINDOW = 128_000


def summarize_main(protocol_out, connection: dict[str, str], api_key: str) -> int:
    """`summarize` 子命令：stdin 一个 JSON → stdout 一行 JSON（`{"summary", "usage"}`，出错 `{"error"}`、退出码 1）。"""
    import json

    from retainpdf_ask_agent.summarize import SummarizeError
    from retainpdf_ask_agent.summarize import summarize
    from retainpdf_ask_agent_engine.stream import make_stream_fn

    try:
        request = json.loads(sys.stdin.read() or "{}")
        if not isinstance(request, dict):
            raise SummarizeError("stdin must be a JSON object")
        result = summarize(request, make_stream_fn(api_key=api_key, **connection))
    except (SummarizeError, json.JSONDecodeError) as error:
        protocol_out.write(json.dumps({"error": str(error)}, ensure_ascii=False) + "\n")
        protocol_out.flush()
        return 1
    except Exception as error:  # 模型请求出错：照样回一行 JSON，后端好转述
        protocol_out.write(json.dumps({"error": f"{type(error).__name__}: {error}"}, ensure_ascii=False) + "\n")
        protocol_out.flush()
        return 1
    protocol_out.write(json.dumps(result, ensure_ascii=False) + "\n")
    protocol_out.flush()
    return 0


def main() -> int:
    # 协议一律 UTF-8，不随系统的语言环境（桌面版、Docker 里的 locale 可能不是 UTF-8）
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    protocol_out = sys.stdout
    sys.stdout = sys.stderr
    model = os.environ.get("RETAIN_ASK_MODEL", "").strip()
    api_key = os.environ.get("RETAIN_ASK_API_KEY", "").strip()
    if not model or not api_key:
        print("retainpdf_ask_agent: RETAIN_ASK_MODEL and RETAIN_ASK_API_KEY are required", file=sys.stderr)
        return 2
    protocol = os.environ.get("RETAIN_ASK_API_PROTOCOL", "").strip()
    if sys.argv[1:2] == ["summarize"]:
        return summarize_main(
            protocol_out,
            {
                "model": model,
                "base_url": os.environ.get("RETAIN_ASK_BASE_URL", "").strip(),
                "protocol": protocol,
                "thinking": os.environ.get("RETAIN_ASK_THINKING", "").strip(),
            },
            api_key,
        )
    from retainpdf_ask_agent.memory import make_memory_tools
    from retainpdf_ask_agent.openui import openui_tools_from_env
    from retainpdf_ask_agent import thinking_choice
    from retainpdf_ask_agent.server import AskAgent
    from retainpdf_ask_agent.tools import make_book_tools
    from retainpdf_ask_agent_engine.stream import make_stream_fn
    from retainpdf_ask_agent_engine.stream import thinking_options

    connection = {
        "model": model,
        "base_url": os.environ.get("RETAIN_ASK_BASE_URL", "").strip(),
        "protocol": protocol,
        "thinking": os.environ.get("RETAIN_ASK_THINKING", "").strip(),
    }
    stream_fn = make_stream_fn(api_key=api_key, **connection)
    # 这个模型的思考档位（session/new 报成 configOptions，会话里能改）；认不出的模型不报。
    # 用户在提问窗里上次选的档记在桥给的文件里（2026-11-27），下次默认它
    choice_file = os.environ.get("RETAIN_ASK_THINKING_FILE", "").strip()
    choice_key = thinking_choice.connection_key(protocol=protocol, base_url=connection["base_url"], model=model)
    thinking = thinking_options(**connection, remembered=thinking_choice.load(choice_file, choice_key))
    context = int(os.environ.get("RETAIN_ASK_CONTEXT_WINDOW", "0") or 0) or DEFAULT_CONTEXT_WINDOW.get(protocol, FALLBACK_CONTEXT_WINDOW)
    tools = make_book_tools(
        job_id=os.environ.get("RETAIN_ASK_JOB_ID", "").strip(),
        document_id=os.environ.get("RETAIN_ASK_DOCUMENT_ID", "").strip(),
        base_url=os.environ.get("RETAIN_ASK_BACKEND_URL", "").strip(),
        api_key=os.environ.get("RETAIN_ASK_BACKEND_KEY", "").strip(),
    )
    openui = openui_tools_from_env()
    memory = make_memory_tools(
        base_url=os.environ.get("RETAIN_ASK_BACKEND_URL", "").strip(),
        api_key=os.environ.get("RETAIN_ASK_BACKEND_KEY", "").strip(),
        conversation_id=os.environ.get("RETAIN_ASK_CONVERSATION_ID", "").strip(),
        document_id=os.environ.get("RETAIN_ASK_DOCUMENT_ID", "").strip(),
        job_id=os.environ.get("RETAIN_ASK_JOB_ID", "").strip(),
    )
    AskAgent(stream_fn, model=model, context_size=context, out=protocol_out, tools=tools, openui=openui, thinking=thinking,
             memory=memory,
             remember_thinking=(lambda value: thinking_choice.save(choice_file, choice_key, value)) if choice_file else None).serve(sys.stdin)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
