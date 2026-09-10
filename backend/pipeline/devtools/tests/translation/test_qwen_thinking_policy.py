from unittest import mock

import pytest

from retainpdf_pipeline.translate.llm.providers.deepseek import client


@pytest.mark.parametrize("model,base,disabled", [
    ("qwen3.8-flash", "https://dashscope.aliyuncs.com/compatible-mode/v1", True),
    ("qwen3.8-flash", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", True),
    ("qwen3.8-flash", "http://127.0.0.1:8000/v1", False),
    ("qwen3.8-flash", "https://dashscope.aliyuncs.com.example.org/v1", False),
    ("qwen3.8-max", "https://dashscope.aliyuncs.com/compatible-mode/v1", False),
    ("deepseek-chat", "https://api.deepseek.com/v1", False),
])
def test_request_thinking_policy_is_scoped_to_verified_model_and_provider(model, base, disabled):
    session = mock.Mock()
    response = session.post.return_value
    response.status_code = 200
    response.json.return_value = {"choices": [{"message": {"content": "译文"}}]}
    with mock.patch.object(client, "get_session", return_value=session), \
         mock.patch.object(client, "get_active_translation_run_diagnostics", return_value=None), \
         mock.patch.object(client, "_prewarm_dns"), \
         mock.patch.object(client, "should_use_stream_responses", return_value=False):
        assert client.request_chat_content([{"role": "user", "content": "Translate"}], model=model, base_url=base) == "译文"
    body = session.post.call_args.kwargs["json"]
    if disabled:
        assert body["enable_thinking"] is False
    else:
        assert "enable_thinking" not in body
    assert session.post.call_count == 1
