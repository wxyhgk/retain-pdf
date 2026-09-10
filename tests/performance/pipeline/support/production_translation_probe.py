"""Offline production-entry probe, executed only in a fresh child process."""
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from support.offline import network_guard, forbid_private_data

def probe(transport, route, outcome, cache_dir):
    from copy import deepcopy
    from contextlib import ExitStack
    from importlib import import_module
    from types import SimpleNamespace
    from unittest.mock import Mock, patch
    import socket
    import time
    import requests
    from retainpdf_pipeline.foundation.config import paths
    from retainpdf_pipeline.translate.llm.shared.rust_executor import ExecutorError
    from retainpdf_pipeline.translate.llm.shared import executor_context as executor
    from retainpdf_pipeline.translate.llm.shared.orchestration import translate_batch
    from retainpdf_pipeline.translate.llm.shared.request_capture import digest
    from retainpdf_pipeline.translate.llm.providers.deepseek import client

    paths.TRANSLATION_UNIT_CACHE_DIR = Path(cache_dir)
    source = "The energy remains conserved in this experiment."
    translated = "在这一实验过程中，体系的能量始终保持守恒。"
    def item(identity):
        return {"item_id": identity, "protected_source_text": source, "source_text": source,
                "translation_unit_protected_source_text": source, "block_type": "text",
                "structure_role": "body", "math_mode": "direct_typst"}
    if route == "group":
        group = item("__cg__:g")
        group.update(continuation_group="g", translation_unit_id="__cg__:g", translation_unit_kind="group",
                     translation_unit_member_ids=["a", "b"],
                     translation_unit_members=[{"item_id": i, "protected_source_text": source} for i in ("a", "b")],
                     translation_unit_protected_source_text=source + " " + source)
        batch = [group]
        content = json.dumps({"member_translations": [{"item_id": i, "translated_text": translated} for i in ("a", "b")]})
    elif route == "batch":
        batch = [dict(item(i), _batched_plain_candidate=True) for i in ("a", "b")]
        content = "\n".join(f"<<<ITEM item_id={i}>>>\n{translated}\n<<<END>>>" for i in ("a", "b"))
    else:
        batch = [item("a")]
        content = translated
    if outcome == "protocol":
        content = ""
    elif outcome == "malformed_json":
        content = "invalid json"
    elif outcome == "semantic":
        # Syntactically valid envelopes, but no translated member content.
        if route == "group":
            content = json.dumps({"member_translations": [
                {"item_id": i, "translated_text": ""} for i in ("a", "b")]})
        elif route == "batch":
            content = "\n".join(f"<<<ITEM item_id={i}>>>\n\n<<<END>>>" for i in ("a", "b"))
        else:
            content = "   "
    calls = []
    def fake_request(**kwargs):
        calls.append(deepcopy(kwargs))
        if outcome == "transport":
            raise ExecutorError("fake transport failure")
        return SimpleNamespace(content=content)
    def fake_post(_url, **kwargs):
        calls.append(deepcopy(kwargs["json"]))
        if outcome == "transport":
            raise requests.ConnectionError("synthetic transport failure")
        response = Mock(status_code=200)
        response.json.return_value = {"choices": [{"message": {"content": content}}]}
        return response
    rt = executor.ExecutorRuntime(SimpleNamespace(request=fake_request))
    sleeps = []
    # Replace module-local clocks only: real deadline/monotonic behavior stays
    # intact, while legacy backoff is recorded instead of actually sleeping.
    clock = SimpleNamespace(sleep=sleeps.append, monotonic=time.monotonic,
                            perf_counter=time.perf_counter, time=time.time)
    with ExitStack() as stack, patch.object(executor, "_runtime", rt), \
         patch.object(client, "_prewarm_dns"), patch.object(client, "should_use_stream_responses", return_value=False), \
         patch.object(client, "get_session", return_value=SimpleNamespace(post=fake_post)):
        for name in ("plain_text_retry", "segment_windows", "segment_executor", "sentence_level", "direct_typst"):
            module = import_module("retainpdf_pipeline.translate.llm.shared.orchestration." + name)
            stack.enter_context(patch.object(module, "time", clock))
        stack.enter_context(patch.object(client, "time", clock))
        failed = False
        error_type = None
        latch_rejected = False
        try:
            result = translate_batch(batch, api_key="fake-key", model="qwen3.8-flash",
                                     base_url="https://dashscope.aliyuncs.com/compatible-mode/v1")
        except Exception as error:
            result, failed = {}, True
            error_type = type(error).__name__
        if rt.failure is not None and transport == "rust":
            previous = len(calls)
            with pytest.raises(ExecutorError):
                translate_batch([item("new-unit")], api_key="fake-key")
            assert len(calls) == previous
            latch_rejected = True
    print(json.dumps({"calls": len(calls), "failed": failed,
                      "http_attempts": len(calls) if transport == "legacy" else 0,
                      "executor_submissions": len(calls) if transport == "rust" else 0,
                      "error_type": error_type, "latch_rejected": latch_rejected,
                      "runtime_failed": rt.failure is not None,
                      "retry_delays": sleeps,
                      "messages_hashes": [digest(c["messages"]) for c in calls],
                      "purposes": [c.get("purpose") for c in calls],
                      "unit_ids": [c.get("unit_id") for c in calls],
                      "thinking": calls[0].get("enable_thinking") if calls else None,
                      "result": {i: {k: v for k, v in r.items() if k in {"translated_text", "decision", "final_status", "member_translations"}}
                                 for i, r in result.items()}}, ensure_ascii=False))


if __name__ == "__main__":
    forbid_private_data()
    with network_guard():
        probe(*sys.argv[1:])
