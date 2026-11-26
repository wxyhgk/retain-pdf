"""记忆和主对话（2026-11-26）：结构化出处、开会话取上下文（记忆进系统提示词最后、最近几轮进历史）、remember / search_memories、
「已记住」的 `_meta`、每一问的额度、`initialize` 报的能力。后端和模型都是假的。"""
from __future__ import annotations

import io
import json
import urllib.parse

from retainpdf_ask_agent import AskAgent
from retainpdf_ask_agent.memory import REMEMBER_PER_TURN
from retainpdf_ask_agent.memory import MemoryTools
from retainpdf_ask_agent.memory import context_history
from retainpdf_ask_agent.memory import make_memory_tools
from retainpdf_ask_agent.selection import selection_text
from retainpdf_ask_agent.selection import with_anchor


def _ok(data):
    return 200, json.dumps({"code": 0, "message": "ok", "data": data}, ensure_ascii=False).encode("utf-8")


MEMORY = {"memory_id": "mem-1", "scope": "user", "document_id": None, "category": "style", "text": "用户要先看结论",
          "updated_at": "2026-11-20T10:00:00Z"}
CONTEXT = {
    "conversation": {"conversation_id": "conv-1", "kind": "main"},
    "summary": None,
    "parent": None,
    "messages": [
        {"role": "assistant", "text": "（上一段没问就开头的回答，要丢掉）"},
        {"role": "user", "text": "哈密顿量是什么", "page": 5},
        {"role": "assistant", "text": "是能量算符"},
        {"role": "side_summary", "text": "深挖结论：本征值是能级"},
    ],
    "memory_text": "【RetainPDF 记下的关于用户的事】\n- [mem-1] 2026-11-20 回答风格：用户要先看结论",
}


class FakeBackend:
    def __init__(self, context=None):
        self.requests = []
        self.context = context

    def __call__(self, method, path, body, timeout):
        self.requests.append((method, path, body))
        if path.startswith("/api/v1/ai/ask-conversations/"):
            return _ok(self.context) if self.context is not None else (404, b'{"message":"not found"}')
        if method == "POST" and path == "/api/v1/ai/memories":
            memory = {**MEMORY, "memory_id": f"mem-{len(self.requests)}", "text": body["text"], "scope": body["scope"],
                      "document_id": body.get("document_id"), "category": body["category"]}
            return _ok({"memory": memory, "created": True, "replaced": body.get("replaces")})
        if method == "GET" and path.startswith("/api/v1/ai/memories?"):
            query = urllib.parse.parse_qs(path.split("?", 1)[1])
            scope = query["scope"][0]
            if scope == "book":
                return _ok({"memories": [{**MEMORY, "memory_id": "mem-b", "scope": "book", "document_id": query["document_id"][0],
                                          "category": "term", "text": "Hamiltonian 定译为哈密顿量"}]})
            return _ok({"memories": [MEMORY]})
        return 500, b"{}"


def _lines(out: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]


def _updates(out: io.StringIO) -> list[dict]:
    return [line["params"]["update"] for line in _lines(out) if line.get("method") == "session/update"]


def _wait(agent: AskAgent) -> None:
    for thread in list(agent._threads):
        thread.join(timeout=5)


SELECTION = {"document_id": "doc-1", "job_id": "job-1", "translation_version": "tv-1", "pane": "translated", "page": 56,
             "item_ids": ["p056-b0003"], "selected_text": "选中的这句", "section": "2.1 方法"}


def test_selection_becomes_an_anchor_and_a_readable_block() -> None:
    meta = with_anchor({"retainpdf": {"selection": SELECTION}})
    assert meta["retainpdf"]["anchor"] == {"page": 56, "item_id": "p056-b0003", "selection": "选中的这句", "source_text": "",
                                           "translated_text": ""}
    # 已经有旧写法的 anchor 就不动；页码不对当没有
    old = {"retainpdf": {"selection": SELECTION, "anchor": {"page": 1}}}
    assert with_anchor(old) is old
    assert with_anchor({"retainpdf": {"selection": {"page": 0}}}) == {"retainpdf": {"selection": {"page": 0}}}
    text = selection_text(SELECTION)
    assert text.startswith("【这一问的出处（RetainPDF）】第 56 页「2.1 方法」（译文栏）")
    assert "选中的字：\n选中的这句" in text and "（块 p056-b0003）" in text


def test_context_history_drops_leading_answers_and_merges_same_side() -> None:
    history = context_history(CONTEXT)
    assert history == [
        {"role": "user", "content": "（第 5 页）哈密顿量是什么"},
        {"role": "assistant", "content": "是能量算符"},
        {"role": "user", "content": "（副对话的结论）深挖结论：本征值是能级"},
    ]
    side = {"parent": {"messages": [{"role": "user", "text": "主对话里问的"}, {"role": "assistant", "text": "主对话里答的"}]},
            "messages": [{"role": "user", "text": "副对话里问的"}]}
    assert [message["content"] for message in context_history(side)] == ["主对话里问的", "主对话里答的", "副对话里问的"]
    assert context_history(None) == []


def test_remember_posts_with_the_turn_source_and_returns_the_memory_meta() -> None:
    backend = FakeBackend()
    tools = MemoryTools(http=backend, conversation_id="conv-1", document_id="doc-0", job_id="job-0")
    tools.set_turn(SELECTION)
    result = tools.run("remember", {"text": "这本书 Hamiltonian 定译为哈密顿量", "scope": "book", "category": "term", "replaces": "mem-old"})
    assert not result.is_error
    method, path, body = backend.requests[-1]
    assert (method, path) == ("POST", "/api/v1/ai/memories")
    assert body == {"scope": "book", "category": "term", "text": "这本书 Hamiltonian 定译为哈密顿量", "origin": "agent",
                    "agent_id": "retainpdf", "document_id": "doc-1", "source_conversation_id": "conv-1", "source_job_id": "job-1",
                    "source_page": 56, "replaces": "mem-old"}
    assert result.meta["memory"]["scope"] == "book" and result.meta["memory"]["replaced"] == "mem-old"
    assert result.summary.startswith("已记住：")
    # 不知道是哪本书：书层记不了；参数不对不发请求
    bookless = MemoryTools(http=backend)
    sent = len(backend.requests)
    assert bookless.run("remember", {"text": "x", "scope": "book"}).is_error
    assert bookless.run("remember", {"text": "x", "scope": "global"}).is_error
    assert bookless.run("remember", {"text": "x" * 501, "scope": "user"}).is_error
    assert len(backend.requests) == sent
    # 后端连不上：工具出错，回给模型
    def down(*_args):
        raise OSError("connection refused")
    assert MemoryTools(http=down).run("remember", {"text": "x", "scope": "user"}).is_error


def test_search_looks_in_the_user_layer_and_this_book() -> None:
    backend = FakeBackend()
    tools = MemoryTools(http=backend, document_id="doc-1")
    result = tools.run("search_memories", {"query": "哈密顿"})
    paths = [path for _, path, _ in backend.requests]
    assert any("scope=user" in path for path in paths) and any("scope=book" in path and "document_id=doc-1" in path for path in paths)
    assert "[mem-1] 2026-11-20 回答风格：用户要先看结论（关于用户）" in result.text
    assert "术语：Hamiltonian 定译为哈密顿量（这本书）" in result.text
    # 没有书：只查用户层
    backend.requests.clear()
    MemoryTools(http=backend).run("search_memories", {"query": "结论"})
    assert len(backend.requests) == 1


def test_make_memory_tools_needs_a_backend() -> None:
    assert make_memory_tools(base_url="", api_key="k") is None
    assert make_memory_tools(base_url="http://127.0.0.1:1", api_key="") is None
    assert make_memory_tools(base_url="file:///x", api_key="k") is None
    tools = make_memory_tools(base_url="http://127.0.0.1:1", api_key="k", conversation_id="../x")
    assert tools is not None and tools.conversation_id == ""


def _agent(stream, backend, conversation_id="conv-1"):
    out = io.StringIO()
    memory = MemoryTools(http=backend, conversation_id=conversation_id, document_id="doc-1")
    agent = AskAgent(stream, model="m", context_size=1000, out=out, memory=memory)
    return agent, out


def test_session_loads_the_conversation_and_puts_memories_last_in_the_system_prompt() -> None:
    requests = []

    def stream(messages, cancel, **options):
        requests.append((list(messages), options))
        yield "text", "好的"
        yield "stop", "end_turn"

    backend = FakeBackend(context=CONTEXT)
    agent, out = _agent(stream, backend)
    agent.handle({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": 1}})
    capabilities = _lines(out)[0]["result"]["agentCapabilities"]
    assert capabilities["_meta"]["retainpdf"] == {"selection": True, "memory": True, "conversation": True}
    assert capabilities["loadSession"] is False
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {"cwd": "/books", "mcpServers": []}})
    assert any("/api/v1/ai/ask-conversations/conv-1/context?" in path and "document_id=doc-1" in path for _, path, _ in backend.requests)
    session = next(iter(agent.sessions))
    agent.handle({"jsonrpc": "2.0", "id": 2, "method": "session/prompt",
                  "params": {"sessionId": session, "prompt": [{"type": "text", "text": "这句什么意思"}],
                             "_meta": {"retainpdf": {"selection": SELECTION}}}})
    _wait(agent)
    messages, options = requests[0]
    systems = [message["content"] for message in messages if message["role"] == "system"]
    assert "你有记忆：remember" in systems[0]  # 固定的那段在前（缓存）
    assert systems[-1] == CONTEXT["memory_text"]  # 记忆在系统消息最后
    assert [tool["name"] for tool in options["tools"]] == ["remember", "search_memories"]
    turns = [message for message in messages if message["role"] != "system"]
    assert turns[0] == {"role": "user", "content": "（第 5 页）哈密顿量是什么"}
    # 问题前面没有前端那段出处：代码写一段
    last = turns[-1]["content"]
    assert last[0]["text"].startswith("【这一问的出处（RetainPDF）】第 56 页") and last[-1]["text"] == "这句什么意思"


def test_without_a_conversation_nothing_is_loaded_and_the_preamble_is_not_repeated() -> None:
    requests = []

    def stream(messages, cancel, **options):
        requests.append(list(messages))
        yield "text", "好"

    backend = FakeBackend(context=CONTEXT)
    agent, out = _agent(stream, backend, conversation_id="")
    agent.handle({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {}})
    assert _lines(out)[0]["result"]["agentCapabilities"]["_meta"]["retainpdf"]["conversation"] is False
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {}})
    assert backend.requests == []
    session = next(iter(agent.sessions))
    preamble = "我在读一本书，第 56 页。\n\n我选中的这段：\n选中的这句\n\n（RetainPDF 任务 job-1，第 56 页）\n\n这句什么意思"
    agent.handle({"jsonrpc": "2.0", "id": 2, "method": "session/prompt",
                  "params": {"sessionId": session, "prompt": [{"type": "text", "text": preamble}],
                             "_meta": {"retainpdf": {"selection": SELECTION}}}})
    _wait(agent)
    user = requests[0][-1]["content"]
    assert len(user) == 1 and user[0]["text"] == preamble


def test_remember_card_carries_the_memory_and_the_per_turn_budget_holds() -> None:
    calls = {"n": 0}

    def stream(messages, cancel, **options):
        calls["n"] += 1
        if calls["n"] == 1:
            for index in range(REMEMBER_PER_TURN + 1):
                yield "tool_call", {"id": f"r{index}", "name": "remember", "arguments": {"text": f"用户偏好 {index}", "scope": "user"}}
        else:
            yield "text", "好的，以后先给结论。"
            yield "stop", "end_turn"

    backend = FakeBackend()
    agent, out = _agent(stream, backend, conversation_id="")
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {}})
    session = next(iter(agent.sessions))
    agent.handle({"jsonrpc": "2.0", "id": 2, "method": "session/prompt",
                  "params": {"sessionId": session, "prompt": [{"type": "text", "text": "以后先给结论"}]}})
    _wait(agent)
    updates = _updates(out)
    cards = [update for update in updates if update.get("sessionUpdate") == "tool_call"]
    assert cards[0]["title"] == "记住：用户偏好 0" and cards[0]["kind"] == "other"
    done = [update for update in updates if update.get("sessionUpdate") == "tool_call_update"]
    remembered = [update for update in done if "memory" in update["_meta"]["retainpdf"]]
    assert len(remembered) == REMEMBER_PER_TURN
    assert remembered[0]["status"] == "completed"
    assert remembered[0]["_meta"]["retainpdf"]["memory"]["text"] == "用户偏好 0"
    assert remembered[0]["_meta"]["retainpdf"]["memory"]["id"].startswith("mem-")
    # 第 4 条超了额度：不执行、卡片失败、不发请求
    assert done[-1]["status"] == "failed" and "memory" not in done[-1]["_meta"]["retainpdf"]
    assert sum(1 for method, path, _ in backend.requests if method == "POST") == REMEMBER_PER_TURN
    result = next(line for line in _lines(out) if line.get("id") == 2)["result"]
    assert result["_meta"]["retainpdf"]["usage"]["memory"] == {"remember_calls": 3, "remembered": 3, "refused": 1}
