"""入口：`python -m retainpdf_ask_agent` 当子进程起，接一个本机的假模型服务（OpenAI Chat 流），走一遍握手、新会话、提问。"""
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
        length = int(self.headers.get("content-length") or 0)
        body = json.loads(self.rfile.read(length))
        self.server.bodies.append(body)  # type: ignore[attr-defined]
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.end_headers()
        for chunk in (
            {"choices": [{"delta": {"content": "你好"}}]},
            {"choices": [{"delta": {}, "finish_reason": "stop"}]},
            {"choices": [], "usage": {"prompt_tokens": 12, "completion_tokens": 3}},
        ):
            self.wfile.write(f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")

    def log_message(self, *args):
        pass


def _env(base_url: str) -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if not key.startswith("RETAIN_ASK_")}
    env.update({"RETAIN_ASK_MODEL": "fake-model", "RETAIN_ASK_BASE_URL": base_url, "RETAIN_ASK_API_PROTOCOL": "openai",
                "RETAIN_ASK_API_KEY": "sk-local-test", "PYTHONPATH": os.pathsep.join(sys.path)})
    return env


def test_missing_configuration_exits_with_a_message():
    env = {key: value for key, value in _env("").items() if key != "RETAIN_ASK_API_KEY"}
    done = subprocess.run([sys.executable, "-m", "retainpdf_ask_agent"], input="", capture_output=True, text=True, env=env, timeout=60)
    assert done.returncode == 2 and "RETAIN_ASK_API_KEY" in done.stderr and done.stdout == ""


def test_a_question_end_to_end_over_stdio():
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeModel)
    server.bodies = []  # type: ignore[attr-defined]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        requests = [
            {"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": 1}},
            {"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {"cwd": "/tmp", "mcpServers": []}},
        ]
        process = subprocess.Popen([sys.executable, "-m", "retainpdf_ask_agent"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, encoding="utf-8", env=_env(f"http://127.0.0.1:{server.server_address[1]}/v1"))
        for request in requests:
            process.stdin.write(json.dumps(request) + "\n")
        process.stdin.flush()
        assert json.loads(process.stdout.readline())["result"]["protocolVersion"] == 1
        session = json.loads(process.stdout.readline())["result"]["sessionId"]
        process.stdin.write(json.dumps({"jsonrpc": "2.0", "id": 2, "method": "session/prompt",
                                        "params": {"sessionId": session, "prompt": [{"type": "text", "text": "打个招呼"}]}}) + "\n")
        process.stdin.close()
        lines = [json.loads(line) for line in process.stdout.read().splitlines() if line.strip()]
        process.wait(timeout=30)
        updates = [line["params"]["update"] for line in lines if line.get("method") == "session/update"]
        assert updates[0] == {"sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "你好"}}
        assert updates[-1]["sessionUpdate"] == "usage_update" and updates[-1]["used"] == 15
        assert lines[-1]["result"]["stopReason"] == "end_turn"
        assert server.bodies[0]["model"] == "fake-model" and server.bodies[0]["stream"] is True  # type: ignore[attr-defined]
    finally:
        server.shutdown()
