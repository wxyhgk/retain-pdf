import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.agent import RetrievalAgent
from retainpdf_ai.tools import Tool, ToolRegistry


def _search_tool(hits):
    def handler(arguments):
        selected = [dict(hit) for hit in hits]
        doc = str(arguments.get("document_id") or "").strip()
        if doc:
            selected = [h for h in selected if h.get("document_id") == doc]
        return {"hits": selected, "document_id": doc or None, "args": dict(arguments)}

    return Tool(
        name="search_fulltext",
        description="Tìm kiếm",
        parameters={"type": "object", "properties": {"query": {"type": "string"}}},
        handler=handler,
    )


HITS = [
    {
        "document_id": "doc-a",
        "job_id": "job-1",
        "page_idx": 3,
        "block_id": "p004-b0002",
        "translated_snippet": "Tốc độ phản ứng tăng đáng kể",
    },
    {
        "document_id": "doc-a",
        "job_id": "job-1",
        "page_idx": 7,
        "block_id": "p008-b0001",
        "translated_snippet": "Tính chọn lọc đến từ hiệu ứng liên hợp",
    },
]


def _tool_call(name, arguments, call_id="call-1"):
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(arguments, ensure_ascii=False)},
    }


def test_agent_runs_tools_then_answers_with_cited_anchors():
    registry = ToolRegistry([_search_tool(HITS)])
    script = iter(
        [
        {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "tính chọn lọc"})]},
        {"content": "Tính chọn lọc đến từ hiệu ứng liên hợp [2].", "tool_calls": []},
        ]
    )
    seen_tool_messages = []

    def fake_chat(messages, tools):
        seen_tool_messages.extend(m for m in messages if m["role"] == "tool")
        return next(script)

    agent = RetrievalAgent(registry, fake_chat, max_tool_rounds=4)
    result = agent.ask("Tại sao có tính chọn lọc?")

    assert result.rounds == 2
    assert result.answer == "Tính chọn lọc đến từ hiệu ứng liên hợp [2]."
    # Chỉ trả về các neo được trích dẫn, và số hiệu đã được ghi vào kết quả tool mà model nhìn thấy
    assert [citation.ref for citation in result.citations] == [2]
    assert result.citations[0].block_id == "p008-b0001"
    payload = json.loads(seen_tool_messages[0]["content"])
    assert payload["hits"][0]["ref"] == 1
    assert result.tool_trace == [
        {"round": 1, "tool": "search_fulltext", "arguments": {"query": "tính chọn lọc"}}
    ]


def test_agent_forces_document_id_into_search_tools():
    """Hỏi đáp toàn cuốn: dù model không truyền document_id thì agent vẫn phải chèn cứng vào."""
    seen_args = []

    def capture(arguments):
        seen_args.append(dict(arguments))
        return {"hits": [dict(HITS[0])]}

    registry = ToolRegistry(
        [
            Tool(
                name="search_fulltext",
                description="Tìm kiếm",
                parameters={"type": "object", "properties": {"query": {"type": "string"}}},
                handler=capture,
            )
        ]
    )
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "tính chọn lọc"})]},
            {"content": "Câu trả lời [1].", "tool_calls": []},
        ]
    )
    agent = RetrievalAgent(registry, lambda m, t: next(script), max_tool_rounds=4)
    result = agent.ask("Tại sao?", document_id="doc-a", job_id="job-1")
    assert seen_args[0]["query"] == "tính chọn lọc"
    assert seen_args[0]["document_id"] == "doc-a"
    assert result.tool_trace[0]["arguments"]["document_id"] == "doc-a"


def test_agent_falls_back_to_all_citations_when_answer_has_no_markers():
    registry = ToolRegistry([_search_tool(HITS)])
    script = iter(
        [
            {"content": "", "tool_calls": [_tool_call("search_fulltext", {"query": "tốc độ"})]},
            {"content": "Tốc độ tăng và có tính chọn lọc.", "tool_calls": []},
        ]
    )
    agent = RetrievalAgent(registry, lambda m, t: next(script), max_tool_rounds=4)
    result = agent.ask("Kết luận?")
    assert [citation.ref for citation in result.citations] == [1, 2]


def test_agent_forces_final_answer_when_rounds_exhausted():
    registry = ToolRegistry([_search_tool(HITS)])
    calls = {"n": 0}

    def looping_chat(messages, tools):
        calls["n"] += 1
        if tools:
            return {
                "content": "",
                "tool_calls": [_tool_call("search_fulltext", {"query": f"q{calls['n']}"})],
            }
        # Lần gọi chốt câu trả lời không đưa tool
        assert messages[-1]["role"] == "user"
        return {"content": "Câu trả lời cuối cùng dựa trên bằng chứng hiện có [1].", "tool_calls": []}

    agent = RetrievalAgent(registry, looping_chat, max_tool_rounds=3)
    result = agent.ask("Câu hỏi luôn muốn tìm kiếm")
    assert result.rounds == 3
    assert "Câu trả lời cuối cùng" in result.answer
    assert len(result.tool_trace) == 3


def test_friendly_llm_error_maps_status_codes():
    """Kiểm toán C1: 402/429/401 phải được dịch thành thông báo người dùng hành động được, và cắt bớt chi tiết từ thượng nguồn."""
    from retainpdf_ai.agent import _friendly_llm_error

    assert "không đủ số dư" in str(_friendly_llm_error(402))
    assert "giới hạn tần suất" in str(_friendly_llm_error(429))
    assert "không hợp lệ" in str(_friendly_llm_error(401))
    assert "lỗi phía thượng nguồn" in str(_friendly_llm_error(503))
    long_detail = "x" * 500
    msg = str(_friendly_llm_error(402, long_detail))
    assert len(msg) < 320
    assert "…" in msg


def test_rounds_exhausted_final_call_uses_request_level_chat_fn():
    """Chốt hồi quy kiểm toán A1: khi env không cấu hình key (chat lúc khởi động ở dạng _missing_key)
    và chat_fn được truyền theo request, vòng chốt lúc hết số vòng phải tiếp tục dùng chat_fn mức request chứ không phải self._chat."""
    registry = ToolRegistry([_search_tool(HITS)])

    def startup_chat_missing_key(_messages, _tools):
        raise RuntimeError("Thiếu LLM API Key")

    calls = {"n": 0}

    def request_chat(messages, tools):
        calls["n"] += 1
        if tools:
            return {
                "content": "",
                "tool_calls": [_tool_call("search_fulltext", {"query": f"q{calls['n']}"})],
            }
        return {"content": "Câu trả lời kết thúc với key cấp request [1].", "tool_calls": []}

    agent = RetrievalAgent(registry, startup_chat_missing_key, max_tool_rounds=2)
    result = agent.ask("Câu hỏi luôn muốn tìm kiếm", chat_fn=request_chat)
    assert result.rounds == 2
    assert "Câu trả lời kết thúc" in result.answer


def test_unknown_tool_and_handler_error_feed_back_to_model():
    def boom(_arguments):
        raise RuntimeError("backend down")

    registry = ToolRegistry(
        [
            Tool(
                name="broken",
                description="always fails",
                parameters={"type": "object", "properties": {}},
                handler=boom,
            )
        ]
    )
    script = iter(
        [
            {
                "content": "",
                "tool_calls": [
                    _tool_call("broken", {}, "c1"),
                    _tool_call("missing", {}, "c2"),
                ],
            },
            {"content": "Tất cả công cụ đều thất bại, không thể trả lời.", "tool_calls": []},
        ]
    )
    captured = []

    def fake_chat(messages, tools):
        captured.extend(m for m in messages if m["role"] == "tool")
        return next(script)

    agent = RetrievalAgent(registry, fake_chat, max_tool_rounds=3)
    result = agent.ask("q")
    assert result.answer.startswith("Tất cả công cụ đều thất bại")
    errors = [json.loads(m["content"]) for m in captured]
    assert any("backend down" in str(e.get("error")) for e in errors)
    assert any("unknown tool" in str(e.get("error")) for e in errors)


def _sse(chunks):
    import json as _json
    lines = [f"data: {_json.dumps(c, ensure_ascii=False)}" for c in chunks]
    lines.append("data: [DONE]")
    return lines


def _content_chunk(text):
    return {"choices": [{"delta": {"content": text}}]}


def _tool_chunk():
    return {"choices": [{"delta": {"tool_calls": [
        {"index": 0, "id": "c1", "type": "function",
         "function": {"name": "search_fulltext", "arguments": "{}"}}
    ]}}]}


def test_streaming_tool_turn_preamble_not_emitted_as_answer_delta():
    """Chốt hồi quy kiểm toán A3: phần content mở đầu của vòng gọi tool không được rò rỉ thành answer_delta."""
    from retainpdf_ai.agent import assemble_streaming_message

    deltas = []
    message = assemble_streaming_message(
        _sse([_content_chunk("Để tôi"), _content_chunk("tìm kiếm một chút…"), _tool_chunk()]),
        on_delta=deltas.append,
    )
    assert deltas == [], f"Phần mở đầu của vòng gọi tool bị rò rỉ: {deltas}"
    assert message["tool_calls"][0]["function"]["name"] == "search_fulltext"
    # content vẫn được giữ trong message (ngữ cảnh trả lại cho model là đầy đủ)
    assert "tìm kiếm một chút" in message["content"]


def test_streaming_pure_answer_still_streams_and_short_answer_flushes():
    from retainpdf_ai.agent import assemble_streaming_message

    # Câu trả lời dài: sau khi gom đủ 64 ký tự để xác định tính chất thì chuyển sang truyền thẳng
    long_piece = "C" * 64
    deltas = []
    assemble_streaming_message(
        _sse([_content_chunk(long_piece), _content_chunk("cuối")]),
        on_delta=deltas.append,
    )
    assert "".join(deltas) == long_piece + "cuối"
    assert len(deltas) == 2, "Sau khi xác định tính chất thì phải truyền thẳng từng piece"

    # Câu trả lời ngắn: chưa đạt ngưỡng, gửi bù một lần khi luồng kết thúc
    deltas2 = []
    assemble_streaming_message(_sse([_content_chunk("Câu trả lời ngắn")]), on_delta=deltas2.append)
    assert "".join(deltas2) == "Câu trả lời ngắn"
