"""Real-binary proof that fx 0.0.5 consumes the loopback endpoint override."""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import subprocess
import threading

import pytest


def test_fx_005_posts_model_turn_to_the_configured_gateway(tmp_path: Path):
    fx = shutil.which("fx")
    if fx is None:
        pytest.skip("fx is not installed")
    version = subprocess.run(
        [fx, "--version"],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if version.returncode != 0 or version.stdout.strip().split()[-1:] != ["0.0.5"]:
        pytest.skip("the live transport proof requires fx 0.0.5")

    captured: list[dict[str, object]] = []

    class GatewayHandler(BaseHTTPRequestHandler):
        def log_message(self, _format: str, *_args: object) -> None:
            return

        def do_POST(self) -> None:  # noqa: N802 - stdlib handler contract
            length = int(self.headers.get("Content-Length", "0") or 0)
            if length:
                self.rfile.read(length)
            captured.append(
                {
                    "method": self.command,
                    "path": self.path,
                    "model": self.headers.get("ai-language-model-id"),
                    # Record presence only. Never retain or print the key/header.
                    "authorization_present": bool(self.headers.get("authorization")),
                }
            )
            body = (
                'data: {"type":"text-start","id":"t1"}\n\n'
                'data: {"type":"text-delta","id":"t1","delta":"probe-ok"}\n\n'
                'data: {"type":"text-end","id":"t1"}\n\n'
                'data: {"type":"finish","finishReason":{"unified":"stop"},'
                '"usage":{"inputTokens":{"total":1},"outputTokens":{"total":1}}}\n\n'
                "data: [DONE]\n\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), GatewayHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    env = {
        "HOME": str(tmp_path / "home"),
        "PATH": os.environ.get("PATH", ""),
        "TMPDIR": str(tmp_path),
        "NO_COLOR": "1",
        "FX_AUTO_UPGRADE": "0",
        "AI_GATEWAY_API_KEY": "live-proof-dummy-key",
        "FX_MODEL": "zai/glm-5.2",
        "FX_GATEWAY_BASE_URL": base_url,
        "FX_GATEWAY_CHAT_URL": f"{base_url}/v3/ai/language-model",
    }
    (tmp_path / "home").mkdir()
    try:
        completed = subprocess.run(
            [
                fx,
                "ask",
                "--json",
                "--no-save",
                "--no-color",
                "--",
                "Reply with ok.",
            ],
            cwd=tmp_path,
            env=env,
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    assert completed.returncode == 0, completed.stderr
    assert json.loads(completed.stdout)["output"] == "probe-ok"
    assert captured == [
        {
            "method": "POST",
            "path": "/v3/ai/language-model",
            "model": "zai/glm-5.2",
            "authorization_present": True,
        }
    ]
