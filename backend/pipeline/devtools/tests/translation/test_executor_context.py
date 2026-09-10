import importlib
import threading
from types import SimpleNamespace
from unittest import mock

import pytest


@pytest.fixture
def execution(monkeypatch):
    ctx = importlib.import_module("retainpdf_pipeline.translate.llm.shared.executor_context")
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "rust")
    client = mock.Mock()
    client.request.return_value = SimpleNamespace(content="译文")
    rt = ctx.ExecutorRuntime(client)
    monkeypatch.setattr(ctx, "_runtime", rt)
    return ctx, rt, client


def test_stable_item_ids_ignore_logging_labels(execution):
    ctx, rt, client = execution

    @ctx.translation_unit
    def translate(item, label):
        return rt.request([{"role": "user", "content": "source"}])

    assert translate({"item_id": "p001-b001"}, "batch 1") == "译文"
    assert translate(item={"item_id": "p001-b001"}, label="batch 99") == "译文"
    first, second = client.request.call_args_list
    assert first.kwargs["operation_id"] == second.kwargs["operation_id"]
    assert first.kwargs["unit_id"] == second.kwargs["unit_id"]
    assert first.kwargs["purpose"] == "primary"


def test_one_protocol_repair_uses_the_same_unit(execution):
    ctx, rt, client = execution
    client.request.side_effect = [SimpleNamespace(content="bad"), SimpleNamespace(content="good")]

    @ctx.translation_unit
    def translate(item):
        content = rt.request([{"role": "user", "content": "source"}])
        if content == "bad":
            raise ValueError("format invalid")
        return content

    assert translate({"item_id": "a"}) == "good"
    first, second = client.request.call_args_list
    assert first.kwargs["unit_id"] == second.kwargs["unit_id"]
    assert [first.kwargs["purpose"], second.kwargs["purpose"]] == ["primary", "repair"]
    assert rt.failure is None


def test_protocol_failure_exhausts_budget_without_raw_fallback(execution):
    ctx, rt, client = execution

    @ctx.translation_unit
    def translate(item):
        rt.request([{"role": "user", "content": "source"}])
        raise ValueError("bad output containing sensitive text")

    with pytest.raises(ctx.ExecutorError, match="bounded repair") as error:
        translate({"item_id": "a"})
    assert "sensitive" not in str(error.value)
    with pytest.raises(ctx.ExecutorError):
        translate({"item_id": "another-unit"})
    assert client.request.call_count == 2


def test_transport_failure_is_not_a_protocol_repair(execution):
    ctx, rt, client = execution
    client.request.side_effect = ctx.ExecutorError("unknown upstream result")

    @ctx.translation_unit
    def translate(item):
        return rt.request([{"role": "user", "content": "source"}])

    with pytest.raises(ctx.ExecutorError):
        translate({"item_id": "a"})
    with pytest.raises(ctx.ExecutorError):
        translate({"item_id": "b"})
    assert client.request.call_count == 1
    rt.check_members([{"item_id": "unrelated-inflight-success"}])


def test_missing_scope_fails_before_any_dispatch(execution):
    ctx, rt, client = execution
    with pytest.raises(ctx.ExecutorError, match="unit scope"):
        rt.request([{"role": "user", "content": "source"}])
    client.request.assert_not_called()


@pytest.mark.parametrize("succeeds", [True, False])
@pytest.mark.parametrize("keyword", [True, False])
def test_partial_batch_repair_keeps_budget_and_only_requests_pending(execution, succeeds, keyword):
    from retainpdf_pipeline.translate.llm.validation.errors import PartialBatchTranslationError
    ctx, rt, client = execution
    submitted = []

    @ctx.translation_unit
    def translate(batch):
        submitted.append([item["item_id"] for item in batch])
        rt.request([{"role": "user", "content": "synthetic"}])
        if len(submitted) == 1:
            raise PartialBatchTranslationError({"a": {"translated_text": "甲"}}, [batch[1]])
        if not succeeds:
            raise PartialBatchTranslationError({}, batch)
        return {"b": {"translated_text": "乙"}}

    batch = [{"item_id": "a"}, {"item_id": "b"}]
    def invoke():
        return translate(batch=batch) if keyword else translate(batch)
    if succeeds:
        assert invoke() == {"a": {"translated_text": "甲"}, "b": {"translated_text": "乙"}}
        assert rt.failure is None
    else:
        with pytest.raises(ctx.ExecutorError, match="bounded repair"):
            invoke()
        with pytest.raises(ctx.ExecutorError):
            invoke()
    assert submitted == [["a", "b"], ["b"]]
    assert client.request.call_count == 2
    first, repair = client.request.call_args_list
    assert first.kwargs["unit_id"] == repair.kwargs["unit_id"]
    assert [first.kwargs["purpose"], repair.kwargs["purpose"]] == ["primary", "repair"]


def test_production_transport_does_not_read_a_key_or_open_upstream_http(execution):
    ctx, rt, client = execution
    transport = importlib.import_module("retainpdf_pipeline.translate.llm.providers.deepseek.client")
    with mock.patch.object(transport, "get_secret", side_effect=AssertionError("secret lookup")), mock.patch.object(transport, "get_session", side_effect=AssertionError("direct HTTP")):
        assert transport.get_api_key(required=True) == ""
        with ctx.unit_scope("domain", ["document-preview"]):
            assert transport.request_chat_content([{"role": "user", "content": "source"}], max_attempts=99, timeout=1) == "译文"
    assert client.request.call_count == 1


def test_legacy_fallback_cannot_turn_executor_error_into_success(execution):
    ctx, rt, client = execution
    module = importlib.import_module("retainpdf_pipeline.translate.workflow.batching.executor")
    client.request.side_effect = ctx.ExecutorError("unknown upstream result")

    @ctx.translation_unit
    def request(item):
        return rt.request([{"role": "user", "content": "source"}])

    def legacy_fallback(batch, **kwargs):
        try:
            request(batch[0])
        except Exception:
            return {"a": {"decision": "keep_origin", "translated_text": "source"}}

    with pytest.raises(ctx.ExecutorError):
        module._translate_batch_or_keep_origin([{"item_id": "a"}], api_key="", model="", base_url="", request_label="", domain_guidance="", mode="fast", context=None, translate_fn=legacy_fallback)


def test_parallel_runner_drains_successes_and_flushes_before_failure(execution, monkeypatch):
    ctx, rt, client = execution
    runner = importlib.import_module("retainpdf_pipeline.translate.workflow.batch_runner")
    bad = [{"item_id": "a"}]
    good = [{"item_id": "b"}]
    both_started = threading.Barrier(2, timeout=5)
    failure_latched = threading.Event()

    def translate(batch, **kwargs):
        # Both requests must be in flight before the failure latch is set.
        both_started.wait()
        if batch == bad:
            failure = rt.fail(ctx.ExecutorError("paused"))
            failure_latched.set()
            raise failure
        assert failure_latched.wait(5), "failure was not latched before successful completion"
        return {"b": {"decision": "translate", "translated_text": "译文"}}

    monkeypatch.setattr(runner, "_translate_batch_or_keep_origin", translate)
    applier = mock.Mock()
    applied = []

    def apply(results):
        applied.extend(results)
        return {0}

    applier.apply_batches.side_effect = apply
    flush = mock.Mock()
    with pytest.raises(ctx.ExecutorError, match="paused"):
        runner.run_translation_batches_parallel(batched_fast_batches=[], single_fast_batches=[bad, good], single_slow_batches=[], queue_workers={"single_fast": 2}, api_key="", model="", base_url="", domain_guidance="", mode="fast", translation_context=None, memory_store=None, result_applier=applier, flush_state=flush)
    assert (bad, {}) in applied
    assert (good, {"b": {"decision": "translate", "translated_text": "译文"}}) in applied
    flush.final_flush.assert_called_once()


def test_control_scope_identity_is_independent_from_translation(execution):
    ctx, rt, client = execution
    for kind in ["classification", "continuation", "agent"]:
        ctx.scoped_request(kind, ["a"], rt.request, [{"role": "user", "content": "source"}])
    assert len({call.kwargs["unit_id"] for call in client.request.call_args_list}) == 3
