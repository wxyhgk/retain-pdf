from __future__ import annotations

import hashlib
import json
import multiprocessing
import os
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.core.payload import (
    load_translations,
    pending_translation_items,
    save_translations,
    write_translation_manifest,
)
from retainpdf_pipeline.translate.workflow.checkpoint import (
    TRANSLATION_CHECKPOINT_FILE_NAME,
    ResumeCandidateFingerprintMismatch,
    TranslationCheckpointSession,
    discard_copied_resume_candidate,
)
from retainpdf_pipeline.translate.workflow.checkpoint.identity import (
    build_translation_identity,
)
from retainpdf_pipeline.translate.workflow.checkpoint.store import (
    CheckpointStore,
)
from retainpdf_pipeline.translate.workflow.execution import (
    TranslationExecutionRequest,
)


def _request(source_json: Path, output_dir: Path, *, model: str = "test-model") -> TranslationExecutionRequest:
    return TranslationExecutionRequest(
        source_json_path=source_json,
        output_dir=output_dir,
        api_key="test-key",
        model=model,
        base_url="https://example.invalid/v1",
    )


def _plan():
    return SimpleNamespace(
        start=0,
        stop=0,
        glossary_entries=[],
        policy_config=SimpleNamespace(
            rule_profile_name="general_sci",
            rule_profile_text="General scientific translation rules.",
            custom_rules_text="",
        ),
    )


def _item(item_id: str, translated_text: str = "") -> dict:
    return {
        "item_id": item_id,
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "asset_id": "",
        "reading_order": 0,
        "raw_block_type": "paragraph",
        "normalized_sub_type": "body",
        "source_text": f"source {item_id}",
        "protected_source_text": f"source {item_id}",
        "translated_text": translated_text,
        "should_translate": True,
        "continuation_group": "",
        "formula_map": [],
        "protected_map": [],
    }


def _crash_after_checkpoint_flush(source_json: str, output_dir: str) -> None:
    output = Path(output_dir)
    page = output / "page-001-deepseek.json"
    payload = [_item("done", "已完成"), _item("pending")]
    checkpoint = TranslationCheckpointSession.acquire(
        _request(Path(source_json), output),
        _plan(),
    )
    save_translations(page, payload)
    checkpoint.update("translating", {0: payload}, {0: page})
    os._exit(23)


def test_checkpoint_lock_rejects_concurrent_writer(tmp_path: Path) -> None:
    checkpoint_path = tmp_path / "translated" / TRANSLATION_CHECKPOINT_FILE_NAME
    first = CheckpointStore(checkpoint_path)
    second = CheckpointStore(checkpoint_path)
    first.acquire()
    try:
        with pytest.raises(RuntimeError, match="already owned"):
            second.acquire()
    finally:
        first.close()


def test_worker_crash_preserves_flush_and_releases_lease(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-crashed" / "translated"
    process = multiprocessing.get_context("spawn").Process(
        target=_crash_after_checkpoint_flush,
        args=(str(source_json), str(output_dir)),
    )
    process.start()
    process.join(timeout=15)

    assert process.exitcode == 23
    assert not (output_dir / "translation-manifest.json").exists()
    checkpoint_payload = json.loads(
        (output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert checkpoint_payload["status"] == "in_progress"
    assert checkpoint_payload["progress"]["completed_item_count"] == 1

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir),
        _plan(),
    ):
        resumed = load_translations(output_dir / "page-001-deepseek.json")
        assert [item["item_id"] for item in pending_translation_items(resumed)] == ["pending"]


def test_page_saved_after_checkpoint_is_rolled_back_on_restart(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-page-gap" / "translated"
    page = output_dir / "page-001-deepseek.json"
    committed = [_item("stable", "已提交")]

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        save_translations(page, committed)
        checkpoint.update("translating", {0: committed}, {0: page})

    # Crash point: repair saved a page, then the process died before the
    # checkpoint marker and stdout observation were published.
    uncommitted = [_item("stable", "未提交 repair")]
    save_translations(page, uncommitted)

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ):
        restored = load_translations(page)
        assert restored[0]["translated_text"] == "已提交"


def test_checkpoint_projects_generation_unit_and_page_hash(
    tmp_path: Path, capsys
) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-projection" / "translated"
    page = output_dir / "page-001-deepseek.json"
    payload = [_item("p1-u1", "已完成")]

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        pending = [_item("p1-u1")]
        save_translations(page, pending)
        checkpoint.update("policy_ready", {0: pending}, {0: page})
        save_translations(page, payload)
        checkpoint.update("translating", {0: payload}, {0: page}, {0: {"p1-u1"}})

    projection = json.loads(
        (output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert projection["schema"] == "translation_checkpoint_v1"
    assert projection["generation"] >= 2
    assert projection["last_committed_unit"]["unit_key"] == "p1-u1"
    assert len(projection["last_committed_unit"]["page_hash"]) == 64
    stdout_records = [
        json.loads(line)
        for line in capsys.readouterr().out.splitlines()
        if line.startswith("{")
    ]
    assert stdout_records[-1]["event_type"] == "pipeline_checkpoint"
    assert stdout_records[-1]["payload"]["committed_pages"] == [
        {
            "unit_key": "page:0",
            "unit_order": 0,
            "page_index": 0,
            "page_hash": hashlib.sha256(page.read_bytes()).hexdigest(),
            "changed_item_ids": ["p1-u1"],
        }
    ]


def test_one_checkpoint_flush_commits_two_pages_with_snapshot_hashes(
    tmp_path: Path, capsys
) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-two-pages" / "translated"
    paths = {
        0: output_dir / "page-001-deepseek.json",
        1: output_dir / "page-002-deepseek.json",
    }
    pending = {0: [_item("p001-b0003")], 1: [_item("p002-b0004")]}

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        for page_idx, path in paths.items():
            save_translations(path, pending[page_idx])
        checkpoint.update("policy_ready", pending, paths)
        translated = {
            0: [_item("p001-b0003", "甲")],
            1: [_item("p002-b0004", "乙")],
        }
        for page_idx, path in paths.items():
            save_translations(path, translated[page_idx])
        checkpoint.update(
            "translating",
            translated,
            paths,
            {0: {"p001-b0003"}, 1: {"p002-b0004"}},
        )

    checkpoint_payload = json.loads(
        (output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert [page["unit_key"] for page in checkpoint_payload["committed_pages"]] == [
        "page:0",
        "page:1",
    ]
    page_records = {page["page_index"]: page for page in checkpoint_payload["pages"]}
    for committed in checkpoint_payload["committed_pages"]:
        page_idx = committed["page_index"]
        snapshot = output_dir / page_records[page_idx]["snapshot_path"]
        assert snapshot.read_bytes() == paths[page_idx].read_bytes()
        assert committed["page_hash"] == hashlib.sha256(snapshot.read_bytes()).hexdigest()

    records = [
        json.loads(line)
        for line in capsys.readouterr().out.splitlines()
        if line.startswith("{")
    ]
    assert len(records[-1]["payload"]["committed_pages"]) == 2


def test_repair_of_completed_translation_emits_changed_item(tmp_path: Path, capsys) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-repair" / "translated"
    page = output_dir / "page-001-deepseek.json"
    payload = [_item("p001-b0003", "旧译文")]

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        save_translations(page, payload)
        checkpoint.update("translating", {0: payload}, {0: page})
        payload[0]["translated_text"] = "修复后的译文"
        save_translations(page, payload)
        checkpoint.update(
            "repairing",
            {0: payload},
            {0: page},
            detect_item_changes=True,
        )

    records = [
        json.loads(line)
        for line in capsys.readouterr().out.splitlines()
        if line.startswith("{")
    ]
    assert records[-1]["payload"]["committed_pages"][0]["changed_item_ids"] == [
        "p001-b0003"
    ]


def test_checkpoint_with_no_translation_change_has_no_page_commit(
    tmp_path: Path, capsys
) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-no-change" / "translated"
    page = output_dir / "page-001-deepseek.json"
    payload = [_item("p001-b0003", "稳定译文")]

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        save_translations(page, payload)
        checkpoint.update("translating", {0: payload}, {0: page})
        checkpoint.update(
            "repairing",
            {0: payload},
            {0: page},
            detect_item_changes=True,
        )

    records = [
        json.loads(line)
        for line in capsys.readouterr().out.splitlines()
        if line.startswith("{")
    ]
    assert records[-1]["payload"]["committed_pages"] == []


def test_saved_checkpoint_is_replayed_after_stdout_failure(
    tmp_path: Path, capsys, monkeypatch
) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-outbox" / "translated"
    page = output_dir / "page-001-deepseek.json"
    pending = [_item("p001-b0003")]
    checkpoint = TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    )
    save_translations(page, pending)
    checkpoint.update("policy_ready", {0: pending}, {0: page})
    translated = [_item("p001-b0003", "已完成")]
    save_translations(page, translated)

    def _fail_after_save(_payload: dict) -> None:
        raise RuntimeError("simulated stdout crash")

    monkeypatch.setattr(checkpoint, "_emit_pipeline_checkpoint", _fail_after_save)
    with pytest.raises(RuntimeError, match="stdout crash"):
        checkpoint.update(
            "translating",
            {0: translated},
            {0: page},
            {0: {"p001-b0003"}},
        )
    checkpoint.close()
    saved = json.loads(
        (output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    failed_generation = saved["generation"]
    assert saved["committed_pages"][0]["changed_item_ids"] == ["p001-b0003"]

    capsys.readouterr()
    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ):
        pass
    replayed = [
        json.loads(line)["payload"]
        for line in capsys.readouterr().out.splitlines()
        if line.startswith("{")
    ]
    durable_replays = [
        payload
        for payload in replayed
        if payload["producer_generation"] == failed_generation
        and payload["committed_pages"]
    ]
    assert len(durable_replays) == 1
    assert durable_replays[0] == saved["committed_pages_event"]


def test_legacy_checkpoint_without_item_fingerprints_remains_resumable(
    tmp_path: Path,
) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-legacy-checkpoint" / "translated"
    page = output_dir / "page-001-deepseek.json"
    pending = [_item("p001-b0003")]
    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        save_translations(page, pending)
        checkpoint.update("policy_ready", {0: pending}, {0: page})

    checkpoint_path = output_dir / TRANSLATION_CHECKPOINT_FILE_NAME
    legacy = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    legacy.pop("committed_pages", None)
    legacy.pop("committed_pages_event", None)
    for page_record in legacy["pages"]:
        page_record.pop("item_fingerprints", None)
    checkpoint_path.write_text(json.dumps(legacy), encoding="utf-8")

    translated = [_item("p001-b0003", "兼容恢复")]
    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        save_translations(page, translated)
        checkpoint.update(
            "translating",
            {0: translated},
            {0: page},
            {0: {"p001-b0003"}},
        )

    resumed = json.loads(checkpoint_path.read_text(encoding="utf-8"))
    assert resumed["schema"] == "translation_checkpoint_v1"
    assert resumed["committed_pages"][0]["changed_item_ids"] == ["p001-b0003"]


def test_read_after_validating_checkpoint_cannot_change_page_hash(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-read-only" / "translated"
    page = output_dir / "page-001-deepseek.json"
    member_ids = ["p1-u1", "p1-u2", "external-u3"]
    payload = [_item("p1-u1", "已完成"), _item("p1-u2", "已完成")]
    for item in payload:
        item.update(
            {
                "continuation_group": "cross-page-group",
                "translation_unit_id": "__cg__:cross-page-group",
                "translation_unit_kind": "group",
                "translation_unit_member_ids": list(member_ids),
                "translation_unit_protected_translated_text": "已完成",
                "group_protected_translated_text": "已完成",
            }
        )

    with TranslationCheckpointSession.acquire(
        _request(source_json, output_dir), _plan()
    ) as checkpoint:
        save_translations(page, payload)
        checkpoint.update("validating", {0: payload}, {0: page})
        checkpoint_hash = hashlib.sha256(page.read_bytes()).hexdigest()

        loaded = load_translations(page, strict_contract=False)

        assert loaded[0]["translation_unit_member_ids"] == member_ids
        assert hashlib.sha256(page.read_bytes()).hexdigest() == checkpoint_hash
        manifest_path = write_translation_manifest(output_dir, {0: page})
        checkpoint.complete(manifest_path)

    committed = json.loads(
        (output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert committed["status"] == "complete"


def test_fingerprint_mismatch_releases_checkpoint_lease(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-a" / "translated"
    with TranslationCheckpointSession.acquire(_request(source_json, output_dir), _plan()):
        pass

    with pytest.raises(RuntimeError, match="fingerprint mismatch"):
        TranslationCheckpointSession.acquire(
            _request(source_json, output_dir, model="different-model"),
            _plan(),
        )

    store = CheckpointStore(output_dir / TRANSLATION_CHECKPOINT_FILE_NAME)
    store.acquire()
    store.close()


def test_checkpoint_identity_tracks_translation_engine_version(tmp_path: Path, monkeypatch) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    request = _request(source_json, tmp_path / "job-a" / "translated")

    first = build_translation_identity(request, _plan())
    monkeypatch.setattr(
        "retainpdf_pipeline.translate.workflow.checkpoint.identity.translation_engine_identity",
        lambda **_kwargs: {
            "prompt_hash": "changed-prompt",
            "translation_protocol_version": "changed-protocol",
        },
    )
    second = build_translation_identity(request, _plan())

    assert first["parameters_sha256"] != second["parameters_sha256"]
    assert first["fingerprint"] != second["fingerprint"]


def test_checkpoint_identity_tracks_resolved_policy_content(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    request = _request(source_json, tmp_path / "job-a" / "translated")
    first_plan = _plan()
    second_plan = _plan()
    second_plan.policy_config.rule_profile_text = "Changed rule profile content."

    first = build_translation_identity(request, first_plan)
    second = build_translation_identity(request, second_plan)

    assert first["parameters_sha256"] != second["parameters_sha256"]
    assert first["fingerprint"] != second["fingerprint"]


def test_checkpoint_rejects_completed_item_regression(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    output_dir = tmp_path / "job-a" / "translated"
    page = output_dir / "page-001-deepseek.json"
    payload = [_item("stable", "已完成")]

    with TranslationCheckpointSession.acquire(_request(source_json, output_dir), _plan()) as checkpoint:
        save_translations(page, payload)
        checkpoint.update("policy_ready", {0: payload}, {0: page})
        payload[0]["translated_text"] = ""
        with pytest.raises(RuntimeError, match="regressed to pending"):
            checkpoint.update("translating", {0: payload}, {0: page})


def test_copied_checkpoint_resumes_only_pending_items(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text('{"schema":"document.v1"}', encoding="utf-8")
    old_output = tmp_path / "job-old" / "translated"
    old_page = old_output / "page-001-deepseek.json"
    old_payload = [_item("done", "已完成"), _item("pending")]

    with TranslationCheckpointSession.acquire(_request(source_json, old_output), _plan()) as checkpoint:
        save_translations(old_page, old_payload)
        checkpoint.update("translating", {0: old_payload}, {0: old_page})

    assert not (old_output / "translation-manifest.json").exists()
    interrupted = json.loads(
        (old_output / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert interrupted["status"] == "in_progress"
    assert interrupted["progress"]["completed_item_count"] == 1
    assert "parameters_sha256" in interrupted
    assert "parameters" not in interrupted
    assert "base_url" not in interrupted

    new_output = tmp_path / "job-new" / "translated"
    new_output.mkdir(parents=True)
    new_page = new_output / old_page.name
    shutil.copy2(old_page, new_page)
    shutil.copy2(
        old_output / TRANSLATION_CHECKPOINT_FILE_NAME,
        new_output / TRANSLATION_CHECKPOINT_FILE_NAME,
    )

    with TranslationCheckpointSession.acquire(_request(source_json, new_output), _plan()) as checkpoint:
        resumed_payload = load_translations(new_page)
        pending = pending_translation_items(resumed_payload)
        assert [item["item_id"] for item in pending] == ["pending"]
        assert checkpoint.payload is not None
        assert checkpoint.payload["resumed_from_attempt_id"] == "job-old"

        resumed_payload[1]["translated_text"] = "现在完成"
        save_translations(new_page, resumed_payload)
        checkpoint.update("validating", {0: resumed_payload}, {0: new_page})
        manifest_path = write_translation_manifest(new_output, {0: new_page})
        checkpoint.complete(manifest_path)

    committed = json.loads(
        (new_output / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert committed["status"] == "complete"
    assert committed["phase"] == "committed"
    assert committed["progress"]["pending_item_count"] == 0
    assert committed["final_manifest"] == "translation-manifest.json"


def test_mismatched_copied_checkpoint_is_explicitly_discarded(tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    old_output = tmp_path / "job-old" / "translated"
    old_page = old_output / "page-001-deepseek.json"
    payload = [_item("pending")]
    with TranslationCheckpointSession.acquire(_request(source_json, old_output), _plan()) as checkpoint:
        save_translations(old_page, payload)
        checkpoint.update("translating", {0: payload}, {0: old_page})

    new_output = tmp_path / "job-new" / "translated"
    new_output.mkdir(parents=True)
    new_page = new_output / old_page.name
    shutil.copy2(old_page, new_page)
    shutil.copy2(
        old_output / TRANSLATION_CHECKPOINT_FILE_NAME,
        new_output / TRANSLATION_CHECKPOINT_FILE_NAME,
    )

    with pytest.raises(ResumeCandidateFingerprintMismatch) as raised:
        TranslationCheckpointSession.acquire(
            _request(source_json, new_output, model="new-model"),
            _plan(),
        )
    discard_copied_resume_candidate(
        new_output,
        source_attempt_id=raised.value.source_attempt_id,
    )

    assert not new_page.exists()
    assert not (new_output / TRANSLATION_CHECKPOINT_FILE_NAME).exists()
    with TranslationCheckpointSession.acquire(
        _request(source_json, new_output, model="new-model"),
        _plan(),
    ) as fresh:
        assert fresh.payload is not None
        assert fresh.payload["attempt_id"] == "job-new"
        assert "resumed_from_attempt_id" not in fresh.payload
