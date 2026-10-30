from __future__ import annotations

import httpx

from retainpdf_ai.agent_llm import build_chat_fn
from retainpdf_ai.config import Settings


def test_ai_tool_rounds_reuse_the_opencode_session(tmp_path):
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        chat = build_chat_fn(Settings(
            llm_base_url="https://opencode.ai/inference/go/v1", llm_model="deepseek-v4.1-flash",
            llm_api_key="test-key", data_root=tmp_path,
        ), client=client)
        for _ in range(2):
            assert chat([{"role": "user", "content": "hello"}], [])['content'] == 'ok'
    assert requests[0].headers['x-opencode-session'] == requests[1].headers['x-opencode-session']
    assert requests[0].headers['user-agent'].startswith('RetainPDF/')
