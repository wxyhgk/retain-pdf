"""模型用量台账：每次返回追加一行，阶段、模型、缓存、思考都留下；没配路径就不记。"""
import json
import threading
from unittest import mock

import pytest

from retainpdf_pipeline.translate.llm.providers.deepseek import client
from retainpdf_pipeline.translate.llm.shared import model_wire, usage_ledger


def _response(payload):
    response = mock.Mock()
    response.status_code = 200
    response.reason = "OK"
    response.url = "https://example.test"
    response.text = ""
    response.json.return_value = payload
    return response


def _call(payloads, **kwargs):
    session = mock.Mock()
    session.post.side_effect = [_response(p) for p in payloads]
    with mock.patch.object(client, "get_session", return_value=session), \
         mock.patch.object(client, "get_active_translation_run_diagnostics", return_value=None), \
         mock.patch.object(client, "_prewarm_dns"), \
         mock.patch.object(client, "should_use_stream_responses", return_value=False):
        return client.request_chat_content(**kwargs)


@pytest.fixture(autouse=True)
def _clean_registry():
    model_wire.clear_registered_connections()
    yield
    model_wire.clear_registered_connections()


@pytest.fixture
def ledger(tmp_path, monkeypatch):
    path = tmp_path / "artifacts" / "token-usage.v1.jsonl"
    monkeypatch.setenv(usage_ledger.LEDGER_ENV, str(path))
    monkeypatch.setenv(usage_ledger.JOB_ID_ENV, "job-1")
    return path


def _rows(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


@pytest.mark.parametrize("label,stage", [
    ("book: batched_fast batch 3/10", "translation"),
    ("book: batch 1/2 req#1", "translation"),
    ("repair p001-b002", "translation"),
    ("classification page 4", "classification"),
    ("continuation-review 2/5", "continuation_review"),
    ("term-prescan b00003", "term_prescan"),
    ("term-review batch 1/2", "term_review"),
    ("style-guide", "style_guide"),
    ("domain-infer", "domain_context"),
    ("refine-review", "refine_review"),
    ("refine-chief", "refine_chief"),
    ("refine-rewrite", "refine_rewrite"),
    ("failure-ai-diagnosis", "failure_diagnosis"),
    ("something-new", "other"),
    ("", "unspecified"),
])
def test_usage_stage_from_request_label(label, stage):
    assert usage_ledger.usage_stage(label) == stage


def test_deepseek_cache_and_reasoning_are_kept(ledger):
    usage = {
        "prompt_tokens": 1000, "completion_tokens": 200, "total_tokens": 1200,
        "prompt_cache_hit_tokens": 800, "prompt_cache_miss_tokens": 200,
        "completion_tokens_details": {"reasoning_tokens": 150},
    }
    _call([{"choices": [{"message": {"content": "译文"}}], "usage": usage}],
          messages=[{"role": "user", "content": "x"}], api_key="k", model="deepseek-flash",
          base_url="https://api.deepseek.com/v1", request_label="book: batch 1/1")
    (row,) = _rows(ledger)
    assert row["job_id"] == "job-1" and row["stage"] == "translation"
    assert row["model"] == "deepseek-flash" and row["host"] == "api.deepseek.com" and row["protocol"] == "openai"
    assert (row["input"], row["output"], row["cache_hit"], row["reasoning"]) == (1000, 200, 800, 150)
    assert row["cache_write"] is None and row["usage_reported"] is True


def test_openai_style_cached_tokens_are_read(ledger):
    usage = {"prompt_tokens": 500, "completion_tokens": 10, "prompt_tokens_details": {"cached_tokens": 384}}
    _call([{"choices": [{"message": {"content": "ok"}}], "usage": usage}],
          messages=[{"role": "user", "content": "x"}], api_key="k", model="m",
          base_url="https://llm.example.com/v1", request_label="term-review batch 1/1")
    (row,) = _rows(ledger)
    assert row["stage"] == "term_review" and row["cache_hit"] == 384


def test_unreported_cache_stays_unknown_not_zero(ledger):
    _call([{"choices": [{"message": {"content": "ok"}}], "usage": {"prompt_tokens": 50, "completion_tokens": 5}}],
          messages=[{"role": "user", "content": "x"}], api_key="k", model="qwen3.8-flash",
          base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", request_label="book: batch 1/1")
    (row,) = _rows(ledger)
    assert row["cache_hit"] is None and row["reasoning"] is None


def test_responses_and_anthropic_usage_reach_the_ledger(ledger):
    _call([{"status": "completed",
            "output": [{"type": "message", "content": [{"type": "output_text", "text": "ok"}]}],
            "usage": {"input_tokens": 70, "input_tokens_details": {"cached_tokens": 64}, "output_tokens": 9,
                      "output_tokens_details": {"reasoning_tokens": 4}, "total_tokens": 79}}],
          messages=[{"role": "user", "content": "x"}], api_key="k", model="gpt-5.6-luna",
          base_url="https://api.openai.com/v1", protocol="openai_responses", request_label="refine-review")
    _call([{"content": [{"type": "text", "text": "ok"}], "stop_reason": "end_turn",
            "usage": {"input_tokens": 10, "output_tokens": 3, "cache_read_input_tokens": 100,
                      "cache_creation_input_tokens": 2000}}],
          messages=[{"role": "user", "content": "x"}], api_key="k", model="claude-sonnet-5",
          base_url="https://api.anthropic.com/v1", protocol="anthropic", request_label="refine-fix")
    responses_row, anthropic_row = _rows(ledger)
    assert (responses_row["input"], responses_row["cache_hit"], responses_row["reasoning"]) == (70, 64, 4)
    assert responses_row["protocol"] == "openai_responses" and responses_row["stage"] == "refine_review"
    assert (anthropic_row["input"], anthropic_row["cache_hit"], anthropic_row["cache_write"]) == (2110, 100, 2000)


def test_tokens_spent_on_an_empty_reply_are_still_recorded(ledger):
    empty = {"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"},
             "output": [{"type": "reasoning", "summary": []}],
             "usage": {"input_tokens": 40, "output_tokens": 900, "total_tokens": 940}}
    with pytest.raises(ValueError):
        _call([empty], messages=[{"role": "user", "content": "x"}], api_key="k", model="gpt-5.6-luna",
              base_url="https://api.openai.com/v1", protocol="openai_responses", max_attempts=1)
    (row,) = _rows(ledger)
    assert row["output"] == 900


def test_missing_usage_is_recorded_as_unreported(ledger):
    _call([{"choices": [{"message": {"content": "ok"}}]}],
          messages=[{"role": "user", "content": "x"}], api_key="k", model="m",
          base_url="https://llm.example.com/v1")
    (row,) = _rows(ledger)
    assert row["usage_reported"] is False and row["input"] == 0


def test_nothing_is_written_without_a_configured_ledger(tmp_path, monkeypatch):
    monkeypatch.delenv(usage_ledger.LEDGER_ENV, raising=False)
    _call([{"choices": [{"message": {"content": "ok"}}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}}],
          messages=[{"role": "user", "content": "x"}], api_key="k", model="m",
          base_url="https://llm.example.com/v1")
    assert not list(tmp_path.rglob("*.jsonl"))


def test_concurrent_appends_never_interleave(tmp_path):
    path = str(tmp_path / "ledger.jsonl")
    record = usage_ledger.build_record(usage={"prompt_tokens": 1, "completion_tokens": 1}, model="m" * 200,
                                       base_url="https://x.test/v1", protocol="openai", request_label="book: batch")
    threads = [threading.Thread(target=lambda: [usage_ledger.append_record(path, record) for _ in range(50)])
               for _ in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    lines = open(path, encoding="utf-8").read().splitlines()
    assert len(lines) == 400 and all(json.loads(line)["model"] == "m" * 200 for line in lines)
