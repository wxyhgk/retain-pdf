"""`python -m retainpdf_ask_agent`：后端的 ACP 桥起的自带 agent（stdio）。

模型配置和密钥由桥经环境变量给（`RETAIN_ASK_MODEL`、`RETAIN_ASK_BASE_URL`、`RETAIN_ASK_API_PROTOCOL`、`RETAIN_ASK_THINKING`、
`RETAIN_ASK_API_KEY`）。stdout 只写协议消息：别的模块的 print 一律改到 stderr。
这是接线的入口，要 import 接线包（核心其余文件只用标准库，测试里单独放过这个文件）。
"""
from __future__ import annotations

import os
import sys

# 上下文窗口（ACP usage_update 的 size）；没给就按协议估个常见值
DEFAULT_CONTEXT_WINDOW = {"anthropic": 200_000}
FALLBACK_CONTEXT_WINDOW = 128_000


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
    from retainpdf_ask_agent.server import AskAgent
    from retainpdf_ask_agent_engine.stream import make_stream_fn

    stream_fn = make_stream_fn(
        model=model,
        base_url=os.environ.get("RETAIN_ASK_BASE_URL", "").strip(),
        api_key=api_key,
        protocol=protocol,
        thinking=os.environ.get("RETAIN_ASK_THINKING", "").strip(),
    )
    context = int(os.environ.get("RETAIN_ASK_CONTEXT_WINDOW", "0") or 0) or DEFAULT_CONTEXT_WINDOW.get(protocol, FALLBACK_CONTEXT_WINDOW)
    AskAgent(stream_fn, model=model, context_size=context, out=protocol_out).serve(sys.stdin)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
