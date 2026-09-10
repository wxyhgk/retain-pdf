from collections import Counter
from copy import deepcopy
import json
import threading
from types import SimpleNamespace

import pytest

from retainpdf_pipeline.translate.core.payload.parts.common import group_unit_id
from retainpdf_pipeline.translate.services.postprocess import garbled_reconstruction as reconstruction
from retainpdf_pipeline.translate.workflow.phases import repair


def item(page):
    return {"item_id": f"p{page + 1:03d}-b000", "page_idx": page,
            "source_text": "The catalyst remains stable.",
            "protected_source_text": "The catalyst remains stable.",
            "formula_map": [], "protected_map": [], "should_translate": True,
            "final_status": "failed", "translated_text": ""}


def issue():
    return SimpleNamespace(kind="synthetic_rejection", as_dict=lambda: {"kind": "synthetic_rejection"})


@pytest.mark.parametrize("text,expected", [
    ("催化剂保持稳定。", "ready"), ("   ", "rejected"), ("", "no_result"),
])
def test_preparation_with_real_validation_does_not_mutate_targets(text, expected):
    targets = [item(0), item(1)]
    before = deepcopy(targets)
    prepared = reconstruction._prepare_reconstruction(targets, text)
    assert prepared.outcome == expected
    assert targets == before
    if expected == "rejected":
        assert "empty_translation" in {issue.kind for issue in prepared.issues}


@pytest.mark.parametrize("text,expected", [
    ("我选择更简洁的表达。因此输出：催化剂保持稳定。", "applied"),
    ("   ", "rejected"), ("", "no_result"),
])
def test_application_never_requests_cleans_or_validates_again(monkeypatch, text, expected):
    targets = [item(0), item(1)]
    for target in targets:
        target["translated_text"] = "旧译文"
        target["translation_diagnostics"] = {"prior_marker": "keep", "route_path": ["batch", "failed"]}
    before = deepcopy(targets)
    prepared = reconstruction._prepare_reconstruction(targets, text)
    def forbidden(*args, **kwargs):
        raise AssertionError("application must only apply the prepared result")
    for name in ("_repair_item_translation", "_clean_reconstructed_text", "_validate_reconstruction"):
        monkeypatch.setattr(reconstruction, name, forbidden)
    result = reconstruction._apply_prepared_reconstruction(targets, prepared)
    assert result.outcome == expected
    assert result.dirty_pages == (frozenset() if expected == "no_result" else frozenset({0, 1}))
    if expected == "no_result":
        assert targets == before
    for target, original in zip(targets, before):
        assert target["translation_diagnostics"]["prior_marker"] == "keep"
        if expected == "applied":
            assert target["translated_text"] == "催化剂保持稳定。"
            assert target["final_status"] == "translated"
            assert target["translation_diagnostics"]["reasoning_leak_salvaged"]
            assert target["translation_diagnostics"]["route_path"] == ["batch", "garbled_reconstruction"]
        elif expected == "rejected":
            assert {k: v for k, v in target.items() if k != "translation_diagnostics"} == {
                k: v for k, v in original.items() if k != "translation_diagnostics"
            }
            assert target["translation_diagnostics"]["garbled_reconstruction_rejected"]


@pytest.mark.parametrize("aggregate", [False, True])
@pytest.mark.parametrize("text", ["催化剂保持稳定。", "   ", ""])
def test_two_step_application_matches_compatibility_entrypoint(aggregate, text):
    targets = [item(0), item(1)]
    if aggregate:
        for target in targets:
            target.update(translation_group_strategy="aggregate_geometry",
                          translation_unit_id=group_unit_id("cross-page-unit"),
                          translation_unit_member_ids=[entry["item_id"] for entry in targets])
        assert reconstruction._is_aggregate_geometry_group(targets[0])
    compatibility_targets = deepcopy(targets)
    expected = reconstruction._apply_reconstruction(compatibility_targets, text)
    prepared = reconstruction._prepare_reconstruction(targets, text)
    actual = reconstruction._apply_prepared_reconstruction(targets, prepared)
    assert actual.outcome == expected
    assert targets == compatibility_targets
    assert actual.dirty_pages == (frozenset({0, 1}) if text else frozenset())


@pytest.mark.parametrize("reject", [False, True])
def test_apply_outcome_matches_actual_translation_state(monkeypatch, reject):
    payload = item(0)
    monkeypatch.setattr(reconstruction, "_validate_reconstruction", lambda *args: [issue()] if reject else [])
    outcome = reconstruction._apply_reconstruction([payload], "催化剂保持稳定。")
    assert outcome == ("rejected" if reject else "applied")
    assert payload["final_status"] == ("failed" if reject else "translated")
    assert payload["translated_text"] == ("" if reject else "催化剂保持稳定。")
    if reject:
        assert payload["translation_diagnostics"]["garbled_reconstruction_rejected"]


@pytest.mark.parametrize("no_items", [False, True])
def test_no_result_does_not_modify_payload_or_validate(monkeypatch, no_items):
    payload = [] if no_items else [item(0)]
    before = deepcopy(payload)
    def forbidden(*args):
        raise AssertionError("no result must not invoke quality validation")
    monkeypatch.setattr(reconstruction, "_validate_reconstruction", forbidden)
    assert reconstruction._apply_reconstruction(payload, "译文" if no_items else "") == "no_result"
    assert payload == before


@pytest.mark.parametrize("workers", [1, 4])
@pytest.mark.parametrize("has_success", [False, True])
def test_stage_counts_only_applied_and_saves_cross_page_rejections(tmp_path, monkeypatch, workers, has_success):
    pages = {page: [item(page)] for page in range(4)}
    paths = {page: tmp_path / f"page-{page}.json" for page in pages}
    # Fix the candidate boundary: one cross-page target, one valid single,
    # one empty response. Use the real runner, application and stage save.
    targets = {"cross": [pages[0][0], pages[1][0]], "good": pages[2], "empty": pages[3]}
    representatives = {key: values[0] for key, values in targets.items()}
    monkeypatch.setattr(reconstruction, "_collect_candidates", lambda items: (targets, representatives))
    monkeypatch.setattr(reconstruction, "_max_candidates_from_env", lambda default: 3)
    monkeypatch.setattr(reconstruction, "_validate_reconstruction",
                        lambda target, text: [issue()] if target["page_idx"] == 0 or not has_success else [])
    calls = []
    lock = threading.Lock()
    def model(target, **kwargs):
        with lock:
            calls.append(target["page_idx"])
        return "" if target["page_idx"] == 3 else "催化剂保持稳定。"
    monkeypatch.setattr(reconstruction, "_repair_item_translation", model)
    monkeypatch.setattr(repair, "_garbled_reconstruction_enabled", lambda: True)
    monkeypatch.setattr(repair, "_garbled_reconstruction_runtime", lambda **kwargs: SimpleNamespace(
        model="offline", display_base_url=lambda: "offline", provider_reason="test"))
    events = []
    monkeypatch.setattr(repair, "emit_stage_progress", lambda **event: events.append(event))
    repair.run_garbled_reconstruction_stage(
        page_payloads=pages, translation_paths=paths, api_key="", model="offline",
        base_url="", workers=workers, run_diagnostics=None,
    )
    final = events[-1]["payload"]
    assert final["garbled_attempted"] == 3
    assert final["garbled_reconstructed"] == int(has_success)
    assert final["garbled_completed"] == 3
    assert final["garbled_applied"] == int(has_success)
    assert final["garbled_rejected"] == (1 if has_success else 2)
    assert final["garbled_no_result"] == 1
    assert final["garbled_failed"] == 0
    assert [(event["progress_current"], event["progress_total"]) for event in events[:-1]] == [(0, 4)] * 3
    assert [event["payload"]["garbled_completed"] for event in events[:-1]] == [1, 2, 3]
    assert events[-1]["progress_current"] == events[-1]["progress_total"] == 4
    assert {0, 1, 2} <= set(final["dirty_pages"])
    assert Counter(calls) == Counter({0: 1, 2: 1, 3: 1})
    for page in (0, 1):
        persisted = json.loads(paths[page].read_text())[0]
        assert persisted["final_status"] == "failed"
        assert persisted["translated_text"] == ""
        assert persisted["translation_diagnostics"]["garbled_reconstruction_rejected"]
    assert json.loads(paths[2].read_text())[0]["final_status"] == ("translated" if has_success else "failed")


@pytest.mark.parametrize("workers", [1, 4])
def test_only_rejected_responses_still_return_dirty_pages(monkeypatch, workers):
    targets = {str(page): [item(page)] for page in (0, 1)}
    monkeypatch.setattr(reconstruction, "_repair_item_translation", lambda *args, **kwargs: "被拒绝的输出")
    monkeypatch.setattr(reconstruction, "_validate_reconstruction", lambda *args: [issue()])
    count, dirty = reconstruction._run_reconstruction_candidates(
        [(key, values[0]) for key, values in targets.items()], candidates_by_key=targets,
        api_key="", model="offline", base_url="", workers=workers,
        runtime=SimpleNamespace(model="offline", display_base_url=lambda: "offline", provider_reason="test"),
    )
    assert count == 0
    assert dirty == {0, 1}


@pytest.mark.parametrize("workers", [1, 8])
@pytest.mark.parametrize("outcomes", [
    ["failed", "failed"], ["no_result", "failed"],
    ["applied", "rejected", "no_result", "failed"],
])
def test_runner_accounts_every_completion_without_leaking_errors(monkeypatch, capsys, workers, outcomes):
    targets = {str(i): [item(i)] for i in range(len(outcomes))}
    calls = Counter()
    lock = threading.Lock()
    def model(target, **kwargs):
        page = target["page_idx"]
        with lock:
            calls[page] += 1
        if outcomes[page] == "failed":
            raise RuntimeError("synthetic-secret-response")
        return "" if outcomes[page] == "no_result" else "催化剂保持稳定。"
    monkeypatch.setattr(reconstruction, "_repair_item_translation", model)
    monkeypatch.setattr(reconstruction, "_validate_reconstruction",
                        lambda target, text: [issue()] if outcomes[target["page_idx"]] == "rejected" else [])
    counts, events = {}, []
    count, dirty = reconstruction._run_reconstruction_candidates(
        [(key, values[0]) for key, values in targets.items()], candidates_by_key=targets,
        api_key="", model="offline", base_url="", workers=workers,
        runtime=SimpleNamespace(model="offline", display_base_url=lambda: "offline", provider_reason="test"),
        result_counts=counts, progress_callback=lambda current, total, pages: events.append((current, total)),
    )
    assert events == [(i, len(outcomes)) for i in range(1, len(outcomes) + 1)]
    assert calls == Counter({i: 1 for i in range(len(outcomes))})
    assert count == counts["garbled_applied"] == outcomes.count("applied")
    assert counts["garbled_completed"] == sum(counts[f"garbled_{kind}"] for kind in ("applied", "rejected", "no_result", "failed")) == len(outcomes)
    assert dirty == {i for i, kind in enumerate(outcomes) if kind in ("applied", "rejected")}
    for i, kind in enumerate(outcomes):
        if kind in ("failed", "no_result"):
            assert targets[str(i)] == [item(i)]
    assert "synthetic-secret-response" not in capsys.readouterr().out


@pytest.mark.parametrize("workers", [1, 8])
@pytest.mark.parametrize("boundary", ["_prepare_reconstruction", "_apply_prepared_reconstruction"])
def test_internal_application_failures_are_not_request_failures(monkeypatch, workers, boundary):
    targets = {str(i): [item(i)] for i in range(2)}
    monkeypatch.setattr(reconstruction, "_repair_item_translation", lambda *args, **kwargs: "催化剂保持稳定。")
    def broken(*args, **kwargs):
        raise RuntimeError("internal-bug")
    monkeypatch.setattr(reconstruction, boundary, broken)
    counts = {}
    with pytest.raises(RuntimeError, match="internal-bug"):
        reconstruction._run_reconstruction_candidates(
            [(key, values[0]) for key, values in targets.items()], candidates_by_key=targets,
            api_key="", model="offline", base_url="", workers=workers,
            runtime=SimpleNamespace(model="offline", display_base_url=lambda: "offline", provider_reason="test"),
            result_counts=counts,
        )
    assert counts["garbled_failed"] == counts["garbled_completed"] == 0


@pytest.mark.parametrize("workers", [1, 8])
@pytest.mark.parametrize("size,budget", [(0, 3), (3, 0), (3, 2)])
@pytest.mark.parametrize("page_entrypoint", [False, True])
def test_public_summaries_account_empty_and_budgeted_candidates(monkeypatch, workers, size, budget, page_entrypoint):
    targets = {str(i): [item(i)] for i in range(size)}
    monkeypatch.setattr(reconstruction, "_collect_candidates", lambda items: (targets, {key: values[0] for key, values in targets.items()}))
    monkeypatch.setattr(reconstruction, "_max_candidates_from_env", lambda default: budget)
    calls = []
    def model(target, **kwargs):
        calls.append(target["page_idx"])
        raise RuntimeError("offline failure")
    monkeypatch.setattr(reconstruction, "_repair_item_translation", model)
    kwargs = dict(api_key="", model="offline", base_url="", workers=workers,
                  runtime=SimpleNamespace(model="offline", display_base_url=lambda: "offline", provider_reason="test"))
    if page_entrypoint:
        summary = reconstruction.reconstruct_garbled_page_payloads({i: values for i, values in enumerate(targets.values())}, **kwargs)
        assert summary["dirty_pages"] == []
    else:
        summary = reconstruction.reconstruct_garbled_items([values[0] for values in targets.values()], **kwargs)
    assert summary["garbled_candidates"] == size
    assert summary["garbled_attempted"] == summary["garbled_completed"] == summary["garbled_failed"] == min(size, budget)
    assert summary["garbled_skipped_by_budget"] == max(0, size - budget)
    assert summary["garbled_reconstructed"] == summary["garbled_applied"] == summary["garbled_rejected"] == summary["garbled_no_result"] == 0
    assert sorted(calls) == list(range(min(size, budget)))


@pytest.mark.parametrize("workers", [1, 8])
def test_failed_stage_finishes_without_claiming_success_or_saving_pages(monkeypatch, workers):
    pages = {i: [item(i)] for i in range(2)}
    targets = {str(i): values for i, values in pages.items()}
    monkeypatch.setattr(reconstruction, "_collect_candidates", lambda items: (targets, {key: values[0] for key, values in targets.items()}))
    monkeypatch.setattr(reconstruction, "_max_candidates_from_env", lambda default: 2)
    def fail(*args, **kwargs):
        raise RuntimeError("offline-failure")
    monkeypatch.setattr(reconstruction, "_repair_item_translation", fail)
    monkeypatch.setattr(repair, "_garbled_reconstruction_enabled", lambda: True)
    monkeypatch.setattr(repair, "_garbled_reconstruction_runtime", lambda **kwargs: SimpleNamespace(
        model="offline", display_base_url=lambda: "offline", provider_reason="test"))
    def forbidden(*args, **kwargs):
        pytest.fail("failed candidates must not save or refresh pages")
    monkeypatch.setattr(repair, "save_pages", forbidden)
    monkeypatch.setattr(repair, "refresh_translation_units_and_collect_changed_pages", forbidden)
    events, transitions = [], []
    monkeypatch.setattr(repair, "emit_stage_progress", lambda **event: events.append(event))
    monkeypatch.setattr(repair, "emit_stage_transition", lambda **event: transitions.append(event))
    repair.run_garbled_reconstruction_stage(
        page_payloads=pages, translation_paths={}, api_key="", model="offline",
        base_url="", workers=workers, run_diagnostics=None,
    )
    assert transitions[0]["progress_current"] == 0
    assert transitions[0]["progress_total"] == 2
    assert [(event["progress_current"], event["progress_total"]) for event in events] == [(0, 2), (0, 2), (2, 2)]
    assert [event["payload"]["garbled_completed"] for event in events] == [1, 2, 2]
    final = events[-1]["payload"]
    assert final["garbled_failed"] == final["garbled_attempted"] == 2
    assert final["garbled_reconstructed"] == final["garbled_applied"] == 0
    assert final["dirty_pages"] == []
