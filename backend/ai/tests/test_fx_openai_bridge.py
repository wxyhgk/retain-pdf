from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

from retainpdf_ai.fx_openai_bridge import (
    FxOpenAIChatBridge,
    gateway_events_from_openai,
    translate_gateway_request,
)


def test_translate_gateway_request_preserves_tool_round() -> None:
    translated = translate_gateway_request(
        {
            "prompt": [
                {"role": "system", "content": "system"},
                {"role": "user", "content": [{"type": "text", "text": "inspect"}]},
                {
                    "role": "assistant",
                    "content": [
                        {
                            "type": "tool-call",
                            "toolCallId": "call-1",
                            "toolName": "inspect_pdf",
                            "input": {"document_id": "doc-a"},
                        }
                    ],
                },
                {
                    "role": "tool",
                    "content": [
                        {
                            "type": "tool-result",
                            "toolCallId": "call-1",
                            "toolName": "inspect_pdf",
                            "output": {"type": "json", "value": {"pages": 2}},
                        }
                    ],
                },
            ],
            "tools": [
                {
                    "type": "function",
                    "name": "inspect_pdf",
                    "description": "inspect",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"document_id": {"type": "string"}},
                    },
                },
                {"type": "provider-defined", "id": "gateway.web_search"},
            ],
            "toolChoice": {"type": "auto"},
        },
        model="qwen-test",
    )

    assert translated["model"] == "qwen-test"
    assert translated["stream"] is False
    assert translated["messages"][2]["tool_calls"][0]["function"] == {
        "name": "inspect_pdf",
        "arguments": '{"document_id":"doc-a"}',
    }
    assert translated["messages"][3] == {
        "role": "tool",
        "tool_call_id": "call-1",
        "content": '{"pages":2}',
    }
    assert translated["tools"][0]["function"]["parameters"]["type"] == "object"
    assert len(translated["tools"]) == 1
    assert translated["tool_choice"] == "auto"


def test_gateway_events_translate_text_and_tool_calls() -> None:
    events = gateway_events_from_openai(
        {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "checking",
                        "tool_calls": [
                            {
                                "id": "call-1",
                                "type": "function",
                                "function": {
                                    "name": "inspect_pdf",
                                    "arguments": '{"document_id":"doc-a"}',
                                },
                            }
                        ],
                    },
                    "finish_reason": "tool_calls",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14},
        }
    )

    assert [event["type"] for event in events] == [
        "stream-start",
        "text-start",
        "text-delta",
        "text-end",
        "tool-call",
        "finish",
    ]
    assert events[4]["input"] == '{"document_id":"doc-a"}'
    assert events[-1]["finishReason"] == {
        "unified": "tool-calls",
        "raw": "tool_calls",
    }


def test_loopback_bridge_forwards_to_openai_compatible_endpoint() -> None:
    captured: dict[str, object] = {}

    class UpstreamHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            length = int(self.headers["content-length"])
            captured["path"] = self.path
            captured["authorization"] = self.headers.get("authorization")
            captured["payload"] = json.loads(self.rfile.read(length))
            body = json.dumps(
                {
                    "choices": [
                        {
                            "message": {"role": "assistant", "content": "bridge ok"},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {
                        "prompt_tokens": 2,
                        "completion_tokens": 2,
                        "total_tokens": 4,
                    },
                }
            ).encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format: str, *args: object) -> None:
            del args

    upstream = ThreadingHTTPServer(("127.0.0.1", 0), UpstreamHandler)
    thread = threading.Thread(target=upstream.serve_forever, daemon=True)
    thread.start()
    host, port = upstream.server_address[:2]
    bridge = FxOpenAIChatBridge(
        base_url=f"http://{host}:{port}/v1",
        model="qwen-test",
        api_key="test-provider-key",
    ).start()
    try:
        with urlopen(
            f"{bridge.gateway_base_url}/coding-agent/v1/models", timeout=5
        ) as response:
            catalog = json.loads(response.read())
        request = Request(
            bridge.chat_url,
            data=json.dumps(
                {
                    "prompt": [
                        {"role": "user", "content": [{"type": "text", "text": "hi"}]}
                    ],
                    "tools": [],
                    "toolChoice": {"type": "auto"},
                }
            ).encode(),
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=5) as response:
            body = response.read().decode()
    finally:
        bridge.close()
        upstream.shutdown()
        upstream.server_close()
        thread.join(timeout=2)

    assert captured["path"] == "/v1/chat/completions"
    assert captured["authorization"] == "Bearer test-provider-key"
    assert captured["payload"]["model"] == "qwen-test"  # type: ignore[index]
    assert '"delta":"bridge ok"' in body
    assert '"unified":"stop"' in body
    assert catalog == {
        "data": [{"id": "qwen-test", "type": "language", "tags": ["tool-use"]}]
    }
