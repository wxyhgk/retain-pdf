from copy import deepcopy
import json
from pathlib import Path
import socket
import sys

import pytest

from tools.analysis import replay_capture as replay
from retainpdf_pipeline.translate.llm.shared import request_capture as capture
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.prompt_building import (
    build_messages, build_group_member_messages, build_single_item_fallback_messages,
)


@pytest.fixture
def snapshot(tmp_path, monkeypatch):
    def no_network(*args, **kwargs):
        raise AssertionError("network is forbidden")
    monkeypatch.setattr(socket, "socket", no_network)
    root = tmp_path.resolve() / "capture"
    monkeypatch.setenv(capture.ENV, str(root))
    monkeypatch.setenv("RETAIN_MODEL_CONNECTION_FINGERPRINT", "connection-a")
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "rust")

    def item(identity, page):
        return {"item_id": identity, "page_idx": page, "math_mode": "direct_typst",
                "protected_source_text": "PRIVATE_SOURCE energy $E=mc^2$.",
                "translation_unit_member_ids": [identity]}

    single = item("p001-a", 0)
    batch = [item("p002-a", 1), item("p002-b", 1)]
    group = item("__cg__:crosspage", 2)
    group.update(translation_unit_kind="group", continuation_group="crosspage",
                 translation_unit_member_ids=["p003-a", "p004-a"],
                 translation_unit_members=[{"item_id": "p003-a", "protected_source_text": "Energy begins"},
                                           {"item_id": "p004-a", "protected_source_text": "and continues."}])
    batches = [[single], batch, [group]]
    originals = deepcopy(batches)
    capture.capture_plan(batches, workers=8, mode="fast", model="fake", domain_guidance="DOMAIN",
                         context=TranslationControlContext(rule_guidance="STATIC_RULE"))
    messages = [build_single_item_fallback_messages(single, domain_guidance="RUNTIME_TERMS_A"),
                build_messages(batch, domain_guidance="RUNTIME_MEMORY_B"),
                build_group_member_messages(group, domain_guidance="RUNTIME_TERMS_C")]
    # Capture out of order to ensure replay uses the plan, not directory/hash order.
    for index in (2, 0, 1):
        unit = replay.batch_identity(batches[index])
        capture.capture_request(operation_id=f"{unit}.primary", unit_id=unit, purpose="primary",
                                messages=messages[index], temperature=0.2, response_format=None)
    assert batches == originals
    return root, batches, messages


def test_fake_replay_restores_plan_order_members_sources_and_runtime_guidance(snapshot, monkeypatch):
    root, batches, messages = snapshot
    before = {p: p.read_bytes() for p in root.iterdir()}
    plan, requests, excluded = replay.prepare(root)
    assert plan["batches"] == batches
    assert [r["messages"] for r in requests] == messages
    assert [r["unit_id"] for r in requests] == [replay.batch_identity(b) for b in batches]
    assert excluded == 0
    delivered = []
    original = replay.FakeModel.request
    def observe(self, request):
        delivered.append(deepcopy(request))
        return original(self, request)
    monkeypatch.setattr(replay.FakeModel, "request", observe)
    result = replay.replay(root)
    assert delivered == requests
    assert result["replayed_requests"] == 3
    assert "PRIVATE_SOURCE" not in json.dumps(result)
    assert "RUNTIME_TERMS" not in json.dumps(result)
    assert all(p.read_bytes() == data for p, data in before.items())
    assert set(root.iterdir()) == set(before)


def test_saved_repair_replayed_after_its_primary(snapshot):
    root, batches, _ = snapshot
    unit = replay.batch_identity(batches[0])
    capture.capture_request(operation_id=f"{unit}.repair", unit_id=unit, purpose="repair",
                            messages=[{"role": "user", "content": "EXACT_REPAIR_INPUT"}],
                            temperature=0, response_format={"type": "json_object"})
    _, ordered, _ = replay.prepare(root)
    assert [r["purpose"] for r in ordered] == ["primary", "repair", "primary", "primary"]
    assert ordered[1]["temperature"] == 0
    assert ordered[1]["response_format"] == {"type": "json_object"}
    assert replay.replay(root)["replayed_repairs"] == 1


@pytest.mark.parametrize("damage", ["missing", "tampered", "wrong_connection", "unknown_unit"])
def test_invalid_capture_stops_before_fake_model(snapshot, monkeypatch, damage):
    root, _, _ = snapshot
    path = next(root.glob("request-*.json"))
    if damage == "missing":
        path.unlink()
    else:
        envelope = json.loads(path.read_text())
        payload = envelope["payload"]
        if damage == "tampered":
            payload["messages"][0]["content"] = "changed without digest"
        elif damage == "wrong_connection":
            payload["connection_fingerprint"] = "different-connection"
            envelope["sha256"] = capture.digest(payload)
        else:
            payload["unit_id"] = "unknown"
            envelope["sha256"] = capture.digest(payload)
        path.write_text(json.dumps(envelope))
    def forbidden(*args):
        raise AssertionError("validation must run before fake model")
    monkeypatch.setattr(replay.FakeModel, "request", forbidden)
    with pytest.raises(ValueError):
        replay.replay(root)


def test_preplan_calls_are_excluded_not_guessed(snapshot):
    root, _, _ = snapshot
    capture._plans.pop(str(root))
    capture.capture_request(operation_id="domain.primary", unit_id="domain", purpose="primary",
                            messages=[{"role": "user", "content": "domain preview"}],
                            temperature=0, response_format=None)
    result = replay.replay(root)
    assert result["excluded_preplan_requests"] == 1
    assert result["replayed_requests"] == 3
