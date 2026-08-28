import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import retainpdf_ai.app as app_module
from retainpdf_ai.agent import RetrievalAgent, assemble_streaming_message
from retainpdf_ai.app import build_app
from retainpdf_ai.config import Settings
from retainpdf_ai.tools import ToolRegistry


def _sse(obj) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False)


def test_assemble_streaming_pure_content_emits_each_delta():
    lines = [
        _sse({"choices": [{"delta": {"content": "Tính"}}]}),
        _sse({"choices": [{"delta": {"content": "chọn lọc đến từ"}}]}),
        _sse({"choices": [{"delta": {"content": "hiệu ứng liên hợp [1]"}}]}),
        "data: [DONE]",
        _sse({"choices": [{"delta": {"content": "bị bỏ qua"}}]}),  # Sau [DONE] thì không xử lý nữa
    ]
    deltas: list[str] = []
    message = assemble_streaming_message(iter(lines), deltas.append)

    # Hợp đồng mới sau kiểm toán A3: 64 ký tự đầu được đệm lại để xác định tính chất (chống rò rỉ
    # phần mở đầu của vòng gọi tool), câu trả lời ngắn được gộp gửi bù khi luồng kết thúc — tổng văn
    # bản không đổi, cách chia mảnh không còn bị chốt cứng theo từng piece
    assert "".join(deltas) == "Tính chọn lọc đến từ hiệu ứng liên hợp [1]"
    assert message["content"] == "Tính chọn lọc đến từ hiệu ứng liên hợp [1]"
    assert "tool_calls" not in message


def test_assemble_streaming_tool_calls_do_not_emit_deltas():
    lines = [
        _sse(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {"name": "search_", "arguments": '{"que'},
                                }
                            ]
                        }
                    }
                ]
            }
        ),
        _sse(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {"index": 0, "function": {"name": "fulltext", "arguments": 'ry":"x"}'}}
                            ]
                        }
                    }
                ]
            }
        ),
        "data: [DONE]",
    ]
    deltas: list[str] = []
    message = assemble_streaming_message(iter(lines), deltas.append)

    assert deltas == []  # Vòng gọi tool tuyệt đối không emit answer_delta
    assert message["content"] == ""
    call = message["tool_calls"][0]
    assert call["id"] == "call-1"
    assert call["function"]["name"] == "search_fulltext"
    assert json.loads(call["function"]["arguments"]) == {"query": "x"}


def test_ask_endpoint_streams_answer_deltas(monkeypatch):
    pieces = ["Tính", "chọn lọc đến từ", "hiệu ứng liên hợp [1]"]
    full = "".join(pieces)

    def fake_build(settings, client=None, *, on_delta=None):
        def chat(messages, tools):  # Hợp đồng 2 tham số: giống bản không streaming
            for piece in pieces:
                if on_delta is not None:
                    on_delta(piece)
            return {"role": "assistant", "content": full, "tool_calls": []}

        return chat

    monkeypatch.setattr(app_module, "build_deepseek_chat_fn", fake_build)

    agent = RetrievalAgent(ToolRegistry([]), lambda m, t: {"content": "", "tool_calls": []})
    settings = Settings(api_keys=frozenset({"test-key"}), llm_api_key="env-llm-key")
    client = TestClient(build_app(settings, agent=agent))

    with client.stream(
        "POST",
        "/v1/ask",
        json={"question": "Tại sao có tính chọn lọc?", "stream": True},
        headers={"X-API-Key": "test-key"},
    ) as response:
        assert response.status_code == 200
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))

    deltas = [event for event in events if event["type"] == "answer_delta"]
    assert [event["text"] for event in deltas] == pieces
    assert events[-1]["type"] == "done"
    assert events[-1]["answer"] == full
    assert "".join(event["text"] for event in deltas) == events[-1]["answer"]
