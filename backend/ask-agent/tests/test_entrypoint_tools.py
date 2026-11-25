"""入口带书：桥给的 `RETAIN_ASK_JOB_ID`、`RETAIN_ASK_BACKEND_URL`、`RETAIN_ASK_BACKEND_KEY` → 模型能调工具读书。
假的模型（OpenAI Chat 流：第一轮调 read_pages，第二轮回答；问题不带字，才给工具）和假的后端（reader/regions）都在本机起。"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer


class FakeModel(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("content-length") or 0)))
        self.server.bodies.append(body)  # type: ignore[attr-defined]
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.end_headers()
        if len(self.server.bodies) == 1:  # type: ignore[attr-defined]
            chunks = [{"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "call_1", "type": "function",
                                                               "function": {"name": "read_pages", "arguments": "{\"pages\": [2]}"}}]}}]},
                      {"choices": [{"delta": {}, "finish_reason": "tool_calls"}]},
                      {"choices": [], "usage": {"prompt_tokens": 40, "completion_tokens": 5}}]
        else:
            chunks = [{"choices": [{"delta": {"content": "讲的是厄米算符（第 2 页）。"}, "finish_reason": "stop"}]},
                      {"choices": [], "usage": {"prompt_tokens": 90, "completion_tokens": 9}}]
        for chunk in chunks:
            self.wfile.write(f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")

    def log_message(self, *args):
        pass


class FakeBackend(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        self.server.seen.append((self.path, self.headers.get("x-api-key")))  # type: ignore[attr-defined]
        items = [{"item_id": "p002-b0001", "source": {"page": 2, "text": "The operator is Hermitian."},
                  "translated": {"page": 2, "text": "这个算符是厄米的。"}, "region_type": "text", "status": "translated", "sub_type": "body"}]
        body = json.dumps({"code": 0, "data": {"items": items}}, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def _serve(handler):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def test_the_agent_reads_the_book_through_the_backend():
    model, model_url = _serve(FakeModel)
    model.bodies = []  # type: ignore[attr-defined]
    backend, backend_url = _serve(FakeBackend)
    backend.seen = []  # type: ignore[attr-defined]
    env = {key: value for key, value in os.environ.items() if not key.startswith("RETAIN_ASK_")}
    env.update({"RETAIN_ASK_MODEL": "fake-model", "RETAIN_ASK_BASE_URL": f"{model_url}/v1", "RETAIN_ASK_API_PROTOCOL": "openai",
                "RETAIN_ASK_API_KEY": "sk-local-test", "RETAIN_ASK_JOB_ID": "job-1", "RETAIN_ASK_DOCUMENT_ID": "doc-1",
                "RETAIN_ASK_BACKEND_URL": backend_url, "RETAIN_ASK_BACKEND_KEY": "agent-key", "PYTHONPATH": os.pathsep.join(sys.path)})
    try:
        process = subprocess.Popen([sys.executable, "-m", "retainpdf_ask_agent"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, encoding="utf-8", env=env)
        process.stdin.write(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {"cwd": "/tmp", "mcpServers": []}}) + "\n")
        process.stdin.flush()
        session = json.loads(process.stdout.readline())["result"]["sessionId"]
        process.stdin.write(json.dumps({"jsonrpc": "2.0", "id": 2, "method": "session/prompt",
                                        "params": {"sessionId": session, "prompt": [{"type": "text", "text": "这本书讲了什么？"}]}}) + "\n")
        process.stdin.close()
        lines = [json.loads(line) for line in process.stdout.read().splitlines() if line.strip()]
        process.wait(timeout=30)
    finally:
        model.shutdown()
        backend.shutdown()
    updates = [line["params"]["update"] for line in lines if line.get("method") == "session/update"]
    assert [update["sessionUpdate"] for update in updates] == ["tool_call", "tool_call_update", "agent_message_chunk", "usage_update"]
    assert updates[0]["title"] == "读第 2 页" and updates[1]["status"] == "completed"
    assert backend.seen == [("/api/v1/jobs/job-1/reader/regions", "agent-key")]  # type: ignore[attr-defined]
    second = model.bodies[1]["messages"]  # type: ignore[attr-defined]
    assert second[-1]["role"] == "tool" and "这个算符是厄米的。" in second[-1]["content"]
    assert model.bodies[0]["tools"][0]["function"]["name"] == "read_pages"  # type: ignore[attr-defined]
    assert updates[-1]["_meta"]["retainpdf"]["usage"]["input_tokens"] == 130
    assert lines[-1]["result"]["stopReason"] == "end_turn"
