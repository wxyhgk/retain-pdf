"""`summarize`：压缩主对话、副对话结论卡片（2026-11-26 第二期）。核心用假的 stream_fn；入口真起子进程接本机假模型服务。"""
from __future__ import annotations

import json
import subprocess
import sys
import threading
from http.server import ThreadingHTTPServer

import pytest

from retainpdf_ask_agent.summarize import MAX_INPUT_CHARS
from retainpdf_ask_agent.summarize import SummarizeError
from retainpdf_ask_agent.summarize import summarize
from retainpdf_ask_agent.summarize import transcript

from test_entrypoint import FakeModel
from test_entrypoint import _env


def _messages():
    return [
        {"seq": 1, "role": "user", "text": "这个算符什么意思？", "document_title": "量子化学", "page": 12},
        {"seq": 2, "role": "assistant", "text": "是 Fock 算符。", "document_title": "量子化学", "page": 12},
        {"seq": 3, "role": "side_summary", "text": "副对话：Fock 算符是平均场近似。"},
    ]


def test_the_transcript_marks_where_each_message_comes_from():
    text = transcript("先前讨论了波函数。", _messages())
    assert text.startswith("【之前的摘要】\n先前讨论了波函数。")
    assert "用户（《量子化学》第 12 页）：这个算符什么意思？" in text
    assert "AI（《量子化学》第 12 页）：是 Fock 算符。" in text
    assert "（副对话的结论）：副对话：Fock 算符是平均场近似。" in text
    long = transcript(None, [{"role": "user", "text": "字" * (MAX_INPUT_CHARS + 100)}])
    assert long.startswith("【对话】\n……（更早的部分略）") and len(long) < MAX_INPUT_CHARS + 50


def test_a_compaction_asks_the_model_with_the_compaction_prompt():
    seen = {}

    def stream_fn(messages, cancel):
        seen["messages"] = messages
        yield "thought", "想一想"
        yield "text", "用户问了 Fock 算符"
        yield "text", "（《量子化学》第 12 页）。"
        yield "usage", {"input_tokens": 50, "output_tokens": 9}
        yield "stop", "end_turn"

    result = summarize({"kind": "compaction", "previous_summary": "旧摘要", "messages": _messages(), "max_chars": 500}, stream_fn)
    assert result == {"summary": "用户问了 Fock 算符（《量子化学》第 12 页）。", "usage": {"input_tokens": 50, "output_tokens": 9}}
    system, user = seen["messages"]
    assert system["role"] == "system" and "压缩摘要" in system["content"] and "500 字" in system["content"]
    assert "旧摘要" in user["content"][0]["text"]


def test_a_side_card_uses_the_side_prompt_and_bad_requests_are_refused():
    seen = {}

    def stream_fn(messages, cancel):
        seen["system"] = messages[0]["content"]
        yield "text", "结论：是平均场。"

    assert summarize({"kind": "side", "messages": _messages()}, stream_fn)["summary"] == "结论：是平均场。"
    assert "结论卡片" in seen["system"]
    for bad in ({"kind": "x", "messages": _messages()}, {"kind": "side", "messages": []}, {"kind": "side", "messages": _messages(), "max_chars": 5}):
        with pytest.raises(SummarizeError):
            summarize(bad, stream_fn)
    with pytest.raises(SummarizeError):
        summarize({"kind": "side", "messages": _messages()}, lambda messages, cancel: iter([("text", "  ")]))


def test_the_summarize_subcommand_end_to_end():
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeModel)
    server.bodies = []  # type: ignore[attr-defined]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        env = _env(f"http://127.0.0.1:{server.server_address[1]}/v1")
        request = {"kind": "side", "messages": _messages()}
        done = subprocess.run([sys.executable, "-m", "retainpdf_ask_agent", "summarize"], input=json.dumps(request), capture_output=True,
                              text=True, encoding="utf-8", env=env, timeout=60)
        assert done.returncode == 0, done.stderr
        result = json.loads(done.stdout)
        assert result["summary"] == "你好" and result["usage"]
        # 交给模型的：系统提示词是副对话卡片那份，用户那条带了出处
        body = server.bodies[0]  # type: ignore[attr-defined]
        assert "结论卡片" in body["messages"][0]["content"]
        bad = subprocess.run([sys.executable, "-m", "retainpdf_ask_agent", "summarize"], input="[]", capture_output=True, text=True,
                             encoding="utf-8", env=env, timeout=60)
        assert bad.returncode == 1 and "error" in json.loads(bad.stdout)
    finally:
        server.shutdown()
