"""单块译文修订写回:校验与翻译时同一套,写回原子,checkpoint 与页文件始终一致。

渲染只认 checkpoint 里登记的 page_hash(render/translation_loader.py),手改
translated/page-*.json 之后渲染直接拒读。修订写回要做的正是「改页文件 + 推进
checkpoint + 换快照」这一整套,任何一步失败都得原样退回。
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import signal
import subprocess
import sys
import textwrap
import time
from copy import deepcopy
from pathlib import Path

import pytest

from retainpdf_pipeline.entrypoints import console
from retainpdf_pipeline.render.translation_loader import load_translated_pages
from retainpdf_translation.public import RevisionOutcome
from retainpdf_translation.public import RevisionRequest
from retainpdf_translation.public import revise_translation_item
from retainpdf_translation.workflow.checkpoint.contract import project_progress
from retainpdf_translation.workflow.checkpoint.store import CheckpointStore
from retainpdf_translation.workflow.revision import load_item_revisions
from retainpdf_translation.workflow import revision as revision_module


_CONTRACT = {
    "block_kind": "text",
    "layout_role": "paragraph",
    "semantic_role": "body",
    "structure_role": "body",
    "policy_translate": True,
    "asset_id": "",
    "raw_block_type": "text",
    "normalized_sub_type": "",
    "math_mode": "direct_typst",
    "formula_map": [],
    "protected_map": [],
}


def _single(item_id: str, page_idx: int, order: int, source: str, translated: str) -> dict:
    return {
        **_CONTRACT,
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": order,
        "reading_order": order,
        "bbox": [72, 100 + order * 40, 520, 130 + order * 40],
        "source_text": source,
        "protected_source_text": source,
        "should_translate": True,
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": source,
        "translation_unit_protected_translated_text": translated,
        "translation_unit_translated_text": translated,
        "protected_translated_text": translated,
        "translated_text": translated,
        "final_status": "translated",
        "translation_diagnostics": {"final_status": "translated"},
    }


def _group_member(item_id: str, page_idx: int, order: int, source: str, translated: str) -> dict:
    unit_source = "Substitute the trial solution and obtain the characteristic equation of the oscillator."
    unit_text = "代入试探解，得到振子的特征方程。"
    return {
        **_single(item_id, page_idx, order, source, translated),
        "translation_unit_id": "__cg__:cg-001",
        "translation_unit_kind": "group",
        "translation_unit_member_ids": ["p001-b003", "p002-b001"],
        "translation_unit_protected_source_text": unit_source,
        "group_protected_source_text": unit_source,
        "translation_unit_protected_translated_text": unit_text,
        "translation_unit_translated_text": unit_text,
        "group_protected_translated_text": unit_text,
        "group_translated_text": unit_text,
        "continuation_group": "cg-001",
    }


def _pages() -> dict[int, list[dict]]:
    formula = {
        **_CONTRACT,
        "item_id": "p001-b002",
        "page_idx": 0,
        "block_idx": 2,
        "reading_order": 2,
        "bbox": [72, 180, 520, 200],
        "block_kind": "formula",
        "policy_translate": False,
        "source_text": "$$ x(t)=A\\cos\\omega t $$",
        "protected_source_text": "$$ x(t)=A\\cos\\omega t $$",
        "should_translate": False,
        "skip_reason": "skip_display_formula",
        "classification_label": "skip_display_formula",
        "translation_unit_id": "p001-b002",
        "translation_unit_kind": "single",
        "translation_unit_member_ids": ["p001-b002"],
        "translated_text": "",
        "protected_translated_text": "",
        "final_status": "kept_origin",
    }
    return {
        0: [
            _single(
                "p001-b001", 0, 1,
                "The harmonic oscillator is a model system for molecular vibrations.",
                "谐振子是分子振动的模型体系。",
            ),
            formula,
            _group_member("p001-b003", 0, 3, "Substitute the trial solution", "代入试探解，"),
        ],
        1: [
            _group_member(
                "p002-b001", 1, 1,
                "and obtain the characteristic equation of the oscillator.",
                "得到振子的特征方程。",
            ),
        ],
    }


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _build_job(root: Path) -> Path:
    translated = root / "translated"
    pages = _pages()
    paths = {idx: translated / f"page-{idx + 1:03d}-deepseek.json" for idx in pages}
    for idx, items in pages.items():
        _write_json(paths[idx], items)
    _write_json(translated / "translation-manifest.json", {
        "schema": "translation_manifest_v1",
        "schema_version": 1,
        "status": "complete",
        "pages": [
            {"page_index": idx, "page_number": idx + 1, "path": paths[idx].name}
            for idx in sorted(pages)
        ],
    })
    checkpoint_pages, progress = project_progress(
        output_dir=translated, page_payloads=deepcopy(pages), translation_paths=paths,
    )
    checkpoint = {
        "schema": "translation_checkpoint_v1",
        "schema_version": 1,
        "status": "complete",
        "phase": "committed",
        "attempt_id": root.name,
        "created_at": "2026-10-01T00:00:00Z",
        "updated_at": "2026-10-01T00:00:00Z",
        "generation": 7,
        "normalized_document_sha256": "b" * 64,
        "parameters_sha256": "a" * 64,
        "fingerprint": "c" * 64,
        "pages": checkpoint_pages,
        "progress": progress,
        "committed_pages": [],
        "final_manifest": "translation-manifest.json",
    }
    store = CheckpointStore(translated / "translation-checkpoint.v1.json")
    store.acquire()
    try:
        store.snapshot_pages(checkpoint)
        store.save(checkpoint)
    finally:
        store.close()
    _write_json(root / "specs" / "translate.spec.json", {"params": {"glossary_entries": []}})
    return translated


def _snapshot(directory: Path) -> dict[str, bytes]:
    return {
        path.relative_to(directory).as_posix(): path.read_bytes()
        for path in sorted(directory.rglob("*"))
        if path.is_file() and path.name != ".translation-checkpoint.lock"
    }


def _checkpoint(translated: Path) -> dict:
    return json.loads((translated / "translation-checkpoint.v1.json").read_text(encoding="utf-8"))


def _assert_publication_consistent(translated: Path) -> None:
    checkpoint = _checkpoint(translated)
    for page in checkpoint["pages"]:
        digest = hashlib.sha256((translated / page["path"]).read_bytes()).hexdigest()
        assert digest == page["page_hash"]
        snapshot = (translated / page["snapshot_path"]).read_bytes()
        assert hashlib.sha256(snapshot).hexdigest() == page["page_hash"]
    # 旧 generation 的快照留着:实时译文按数据库登记的(修订前)哈希去找它。
    snapshots = {p.name for p in (translated / ".translation-checkpoints").iterdir()}
    assert {"generation-7", f"generation-{checkpoint['generation']}"} <= snapshots


def _items_by_id(translated: Path) -> dict[str, dict]:
    pages = load_translated_pages(translated)
    return {item["item_id"]: item for items in pages.values() for item in items}


def test_revision_rewrites_page_advances_checkpoint_and_render_reads_it(tmp_path):
    translated = _build_job(tmp_path)

    result = revise_translation_item(tmp_path, RevisionRequest(
        item_id="p001-b001", translated_text="谐振子是描述分子振动的模型体系。",
        source="user", reason="措辞",
    ))

    assert result["outcome"] == "committed" and result["changed"] is True
    assert result["generation"] == 8
    _assert_publication_consistent(translated)
    checkpoint = _checkpoint(translated)
    assert (checkpoint["status"], checkpoint["phase"]) == ("complete", "committed")
    assert checkpoint["committed_pages_event"]["producer_generation"] == 8
    page_hash = checkpoint["pages"][0]["page_hash"]
    assert result["page_hashes"] == {"page-001-deepseek.json": page_hash}
    # 渲染侧按 page_hash 校验读取:读得出来,而且读到的是修订后的译文。
    item = _items_by_id(translated)["p001-b001"]
    assert item["translated_text"] == "谐振子是描述分子振动的模型体系。"
    assert item["translation_unit_translated_text"] == "谐振子是描述分子振动的模型体系。"
    assert item["translation_diagnostics"]["manual_revision_id"] == result["revision"]["revision_id"]

    [record] = load_item_revisions(translated, "p001-b001")
    assert record == result["revision"]
    assert {
        "revision_id", "item_id", "page_idx", "ts", "source", "reason",
        "previous_text", "new_text", "validation", "generation",
    } <= set(record)
    assert (record["previous_text"], record["new_text"]) == (
        "谐振子是分子振动的模型体系。", "谐振子是描述分子振动的模型体系。",
    )
    assert (record["source"], record["reason"], record["generation"]) == ("user", "措辞", 8)


def test_group_member_revision_rebuilds_the_unit_on_every_page(tmp_path):
    translated = _build_job(tmp_path)

    result = revise_translation_item(tmp_path, RevisionRequest(
        item_id="p002-b001", translated_text="即得振子的特征方程。", source="agent",
    ))

    assert set(result["page_hashes"]) == {"page-001-deepseek.json", "page-002-deepseek.json"}
    _assert_publication_consistent(translated)
    items = _items_by_id(translated)
    assert items["p002-b001"]["translated_text"] == "即得振子的特征方程。"
    assert items["p001-b003"]["translated_text"] == "代入试探解，"
    for member in ("p001-b003", "p002-b001"):
        assert items[member]["translation_unit_translated_text"] == "代入试探解，即得振子的特征方程。"
        assert items[member]["group_translated_text"] == "代入试探解，即得振子的特征方程。"


@pytest.mark.parametrize(("text", "kind"), [
    ("谐振子 $x^2 是模型体系。", "math_delimiter_unbalanced"),
    ("   ", "empty_translation"),
    ('{"translations": [{"item_id": "p001-b001", "translated_text": "谐振子"}]}', "protocol_shell_output"),
])
def test_validation_failure_is_rejected_without_touching_any_file(tmp_path, text, kind):
    translated = _build_job(tmp_path)
    before = _snapshot(translated)

    with pytest.raises(RevisionOutcome) as raised:
        revise_translation_item(tmp_path, RevisionRequest(
            item_id="p001-b001", translated_text=text, source="user",
        ))

    assert (raised.value.outcome, raised.value.reason) == ("rejected", "validation_failed")
    validation = raised.value.extra["validation"]
    assert validation["passed"] is False
    assert kind in {issue["kind"] for issue in validation["issues"]}
    assert _snapshot(translated) == before


@pytest.mark.parametrize(("item_id", "outcome", "reason"), [
    ("p001-b002", "rejected", "item_not_translatable"),
    ("p009-b001", "not_found", "item_not_found"),
])
def test_untranslatable_or_missing_items_are_refused(tmp_path, item_id, outcome, reason):
    translated = _build_job(tmp_path)
    before = _snapshot(translated)

    with pytest.raises(RevisionOutcome) as raised:
        revise_translation_item(tmp_path, RevisionRequest(
            item_id=item_id, translated_text="随便", source="user",
        ))

    assert (raised.value.outcome, raised.value.reason) == (outcome, reason)
    assert _snapshot(translated) == before


def test_running_worker_lock_and_stale_generation_are_conflicts(tmp_path):
    translated = _build_job(tmp_path)
    request = RevisionRequest(item_id="p001-b001", translated_text="谐振子模型。", source="user")
    worker = CheckpointStore(translated / "translation-checkpoint.v1.json")
    worker.acquire()
    try:
        with pytest.raises(RevisionOutcome) as raised:
            revise_translation_item(tmp_path, request)
        assert (raised.value.outcome, raised.value.reason) == ("conflict", "checkpoint_locked")
    finally:
        worker.close()

    stale = RevisionRequest(
        item_id="p001-b001", translated_text="谐振子模型。", source="user", expected_generation=6,
    )
    with pytest.raises(RevisionOutcome) as raised:
        revise_translation_item(tmp_path, stale)
    assert (raised.value.outcome, raised.value.reason) == ("conflict", "generation_mismatch")
    assert raised.value.extra["current_generation"] == 7


def test_uncommitted_translation_cannot_be_revised(tmp_path):
    translated = _build_job(tmp_path)
    path = translated / "translation-checkpoint.v1.json"
    checkpoint = _checkpoint(translated)
    checkpoint.update(status="in_progress", phase="translating")
    path.write_text(json.dumps(checkpoint), encoding="utf-8")

    with pytest.raises(RevisionOutcome) as raised:
        revise_translation_item(tmp_path, RevisionRequest(
            item_id="p001-b001", translated_text="谐振子模型。", source="user",
        ))
    assert (raised.value.outcome, raised.value.reason) == ("conflict", "translation_not_committed")


def test_identical_text_is_a_no_op(tmp_path):
    translated = _build_job(tmp_path)
    before = _snapshot(translated)

    result = revise_translation_item(tmp_path, RevisionRequest(
        item_id="p001-b001", translated_text="谐振子是分子振动的模型体系。", source="user",
    ))

    assert (result["outcome"], result["changed"], result["revision"]) == ("unchanged", False, None)
    assert _snapshot(translated) == before


def test_failure_after_page_write_restores_every_file(tmp_path, monkeypatch):
    translated = _build_job(tmp_path)
    revise_translation_item(tmp_path, RevisionRequest(
        item_id="p001-b001", translated_text="第一次修订。", source="user",
    ))
    before = _snapshot(translated)

    def explode(self, payload):
        raise OSError("disk full")

    monkeypatch.setattr(CheckpointStore, "save", explode)
    with pytest.raises(OSError, match="disk full"):
        revise_translation_item(tmp_path, RevisionRequest(
            item_id="p002-b001", translated_text="即得特征方程。", source="user",
        ))

    assert _snapshot(translated) == before
    monkeypatch.undo()
    _assert_publication_consistent(translated)
    assert len(load_item_revisions(translated, "p001-b001")) == 1


def test_console_subcommand_reports_structured_outcomes(tmp_path, monkeypatch, capsys):
    _build_job(tmp_path)

    def run(body: dict) -> dict:
        monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(body, ensure_ascii=False)))
        exit_code = console.main([
            "translation-revise", "--job-root", str(tmp_path), "--item-id", "p001-b001",
        ])
        assert exit_code == 0
        return json.loads(capsys.readouterr().out)

    committed = run({"translated_text": "谐振子模型。", "source": "refine", "reason": "精修"})
    assert committed["outcome"] == "committed"
    assert committed["revision"]["source"] == "refine"
    rejected = run({"translated_text": "谐振子 $x", "source": "user"})
    assert (rejected["outcome"], rejected["reason"]) == ("rejected", "validation_failed")
    invalid = run({"translated_text": "谐振子", "source": "robot"})
    assert (invalid["outcome"], invalid["reason"]) == ("invalid", "invalid_source")


def _write_replay_spec(job_root: Path) -> None:
    source_json = job_root / "ocr" / "normalized" / "document.v1.json"
    _write_json(source_json, {"pages": []})
    source_pdf = job_root / "source" / "input.pdf"
    source_pdf.parent.mkdir(parents=True, exist_ok=True)
    source_pdf.write_bytes(b"%PDF-1.4\n")
    _write_json(job_root / "specs" / "translate.spec.json", {
        "schema_version": "translate.stage.v1",
        "stage": "translate",
        "job": {"job_id": "job-replay-commit", "job_root": str(job_root), "workflow": "translate"},
        "inputs": {
            "source_json": str(source_json),
            "source_pdf": str(source_pdf),
            "layout_json": str(source_json),
        },
        "params": {
            "start_page": 0, "end_page": 0, "batch_size": 1, "workers": 1,
            "mode": "sci", "math_mode": "direct_typst", "skip_title_translation": False,
            "classify_batch_size": 12, "rule_profile_name": "general_sci",
            "custom_rules_text": "保留化学式。", "glossary_id": "", "glossary_name": "",
            "glossary_resource_entry_count": 0, "glossary_inline_entry_count": 0,
            "glossary_overridden_entry_count": 0, "glossary_entries": [],
            "model": "deepseek-chat", "base_url": "https://api.deepseek.com/v1",
            "credential_ref": "",
        },
    })


@pytest.mark.parametrize("replayed_text", ["谐振子是分子振动的经典模型。", "谐振子 $x"])
def test_replay_commit_writes_back_through_the_validated_revision_path(
    tmp_path, monkeypatch, replayed_text,
):
    import devtools.replay_translation_item as replay_module

    translated = _build_job(tmp_path)
    _write_replay_spec(tmp_path)
    monkeypatch.setenv("RETAIN_TRANSLATION_API_KEY", "test-key")
    seen_rules: list[str] = []
    real_policy_config = replay_module.build_translation_policy_config

    def _policy_config(**kwargs):
        seen_rules.append(kwargs["custom_rules_text"])
        return real_policy_config(**kwargs)

    def _fake_translate_batch(batch, **_kwargs):
        return {batch[0]["item_id"]: {"decision": "translate", "translated_text": replayed_text}}

    monkeypatch.setattr(replay_module, "build_translation_policy_config", _policy_config)
    monkeypatch.setattr(replay_module, "translate_batch", _fake_translate_batch)
    before = _snapshot(translated)

    dry_run = replay_module.replay_translation_item(tmp_path, "p001-b001", instruction="更口语一些")
    assert "commit" not in dry_run
    assert _snapshot(translated) == before
    assert seen_rules[-1] == "保留化学式。\n更口语一些"

    result = replay_module.replay_translation_item(
        tmp_path, "p001-b001", instruction="更口语一些", commit=True,
    )

    if "$" in replayed_text:
        assert (result["commit"]["outcome"], result["commit"]["reason"]) == (
            "rejected", "validation_failed",
        )
        assert _snapshot(translated) == before
        return
    assert result["commit"]["outcome"] == "committed"
    [record] = load_item_revisions(translated, "p001-b001")
    assert (record["source"], record["reason"], record["new_text"]) == (
        "refine", "replay: 更口语一些", replayed_text,
    )
    _assert_publication_consistent(translated)



# ---------------------------------------------------------------------------
# 崩溃一致性:进程在写回的任何两步之间被杀(SIGKILL、断电),重新进入时必须
# 得到「完全是旧的」或「完全是新的」,不能是页文件领先 checkpoint 的混合状态,
# 之后的修订也不能一直 409 publication_inconsistent。
# ---------------------------------------------------------------------------

NEW_TEXT = "谐振子是描述分子振动的模型体系。"
_REQUEST = RevisionRequest(item_id="p001-b001", translated_text=NEW_TEXT, source="user", reason="崩溃")


class _Crash(BaseException):
    """模拟进程在这一刻被杀:不是 Exception,所以普通的 except Exception 拦不住。"""


class _Tracer:
    def __init__(self, crash_index: int | None = None) -> None:
        self.crash_index = crash_index
        self.events: list[str] = []

    def tick(self, label: str) -> None:
        index = len(self.events)
        self.events.append(label)
        if index == self.crash_index:
            raise _Crash(label)


def _install_tracer(monkeypatch, tracer: _Tracer, *, killed: bool) -> None:
    """给写盘的每一步前后各记一个事件;``killed`` 时把进程内回滚也去掉(进程死了谁来回滚)。"""

    real_write = revision_module._atomic_write_bytes

    def write(path, data):
        tracer.tick(f"pre:write {Path(path).name}")
        real_write(path, data)
        tracer.tick(f"post:write {Path(path).name}")

    monkeypatch.setattr(revision_module, "_atomic_write_bytes", write)
    for name, label in (("save", "checkpoint save"), ("snapshot_pages", "snapshot")):
        real = getattr(CheckpointStore, name)

        def wrapped(self, payload, _real=real, _label=label):
            tracer.tick(f"pre:{_label}")
            _real(self, payload)
            tracer.tick(f"post:{_label}")

        monkeypatch.setattr(CheckpointStore, name, wrapped)
    if hasattr(revision_module, "_remove_intent"):
        real_remove = revision_module._remove_intent

        def remove(path):
            tracer.tick("pre:intent remove")
            real_remove(path)
            tracer.tick("post:intent remove")

        monkeypatch.setattr(revision_module, "_remove_intent", remove)
    if killed:
        monkeypatch.setattr(revision_module, "_rollback", lambda **_kwargs: None)


def _trace_clean_run(tmp_path, monkeypatch) -> list[str]:
    _build_job(tmp_path / "trace")
    tracer = _Tracer()
    with monkeypatch.context() as patch:
        _install_tracer(patch, tracer, killed=True)
        revise_translation_item(tmp_path / "trace", _REQUEST)
    assert any(event.startswith("pre:write page-") for event in tracer.events)
    return tracer.events


def _item_text(translated: Path, item_id: str = "p001-b001") -> str:
    return _items_by_id(translated)[item_id]["translated_text"]


def test_kill_at_every_step_never_leaves_the_job_stuck(tmp_path, monkeypatch):
    events = _trace_clean_run(tmp_path, monkeypatch)
    for crash_index, label in enumerate(events):
        root = tmp_path / f"kill-{crash_index}"
        translated = _build_job(root)
        with monkeypatch.context() as patch:
            _install_tracer(patch, _Tracer(crash_index), killed=True)
            with pytest.raises(_Crash):
                revise_translation_item(root, _REQUEST)

        # 重发同一个请求:不得 409 publication_inconsistent,最终必须是干净的「新」。
        try:
            result = revise_translation_item(root, _REQUEST)
        except RevisionOutcome as outcome:
            pytest.fail(f"killed at {label!r}: next revise refused with {outcome.reason}")
        assert result["outcome"] in {"committed", "unchanged"}, label
        assert result["generation"] == 8, label
        _assert_publication_consistent(translated)
        assert _item_text(translated) == NEW_TEXT, label
        records = load_item_revisions(translated, "p001-b001")
        assert len(records) == 1 and records[0]["generation"] == 8, label
        assert records[0]["page_hashes"] == {
            "page-001-deepseek.json": _checkpoint(translated)["pages"][0]["page_hash"]
        }, label
        assert not (translated / revision_module.TRANSLATION_REVISION_INTENT_FILE_NAME).exists(), label


def test_recovery_after_kill_yields_all_old_or_all_new(tmp_path, monkeypatch):
    events = _trace_clean_run(tmp_path, monkeypatch)
    outcomes = set()
    for crash_index, label in enumerate(events):
        root = tmp_path / f"recover-{crash_index}"
        translated = _build_job(root)
        before = _snapshot(translated)
        with monkeypatch.context() as patch:
            _install_tracer(patch, _Tracer(crash_index), killed=True)
            with pytest.raises(_Crash):
                revise_translation_item(root, _REQUEST)

        store = CheckpointStore(translated / "translation-checkpoint.v1.json")
        store.acquire()
        try:
            revision_module.recover_incomplete_revision(translated, store)
        finally:
            store.close()

        checkpoint = _checkpoint(translated)
        _assert_publication_consistent(translated) if checkpoint["generation"] == 8 else None
        if checkpoint["generation"] == 7:
            outcomes.add("old")
            # 回到修订之前,逐字节一致:页、checkpoint、快照目录、临时文件、日志、意图文件。
            assert _snapshot(translated) == before, label
        else:
            outcomes.add("new")
            assert checkpoint["generation"] == 8, label
            assert _item_text(translated) == NEW_TEXT, label
            [record] = load_item_revisions(translated, "p001-b001")
            assert record["page_hashes"]["page-001-deepseek.json"] == checkpoint["pages"][0]["page_hash"], label
            assert not (translated / revision_module.TRANSLATION_REVISION_INTENT_FILE_NAME).exists(), label
            assert not [p for p in translated.iterdir() if p.name.endswith(".tmp")], label
    # 两种结局都得出现过:checkpoint 落盘之前被杀 → 旧;之后被杀 → 新(日志补上)。
    assert outcomes == {"old", "new"}


def test_kill_while_rolling_back_still_recovers(tmp_path, monkeypatch):
    # 写 checkpoint 失败 → 进程内回滚开始 → 回滚途中进程又被杀。
    clean_events: list[str] = []

    def failing_save(self, payload):
        raise OSError("disk full")

    root = tmp_path / "rb-trace"
    _build_job(root)
    tracer = _Tracer()
    with monkeypatch.context() as patch:
        _install_tracer(patch, tracer, killed=False)
        patch.setattr(CheckpointStore, "save", failing_save)
        with pytest.raises(OSError):
            revise_translation_item(root, _REQUEST)
        clean_events = tracer.events
    failure_at = max(i for i, event in enumerate(clean_events) if event.startswith("pre:snapshot")) + 1
    assert len(clean_events) > failure_at + 1

    for crash_index in range(failure_at, len(clean_events)):
        root = tmp_path / f"rb-{crash_index}"
        translated = _build_job(root)
        with monkeypatch.context() as patch:
            _install_tracer(patch, _Tracer(crash_index), killed=False)
            patch.setattr(CheckpointStore, "save", failing_save)
            with pytest.raises((OSError, _Crash)):
                revise_translation_item(root, _REQUEST)
        result = revise_translation_item(root, _REQUEST)
        assert result["outcome"] in {"committed", "unchanged"}, clean_events[crash_index]
        _assert_publication_consistent(translated)
        assert _item_text(translated) == NEW_TEXT
        assert len(load_item_revisions(translated, "p001-b001")) == 1


def test_pages_ahead_of_checkpoint_without_intent_are_healed_not_409(tmp_path):
    # 修这个问题之前被杀留下的现场:页文件已是新内容,checkpoint 还是旧的,没有意图记录。
    translated = _build_job(tmp_path)
    page_path = translated / "page-001-deepseek.json"
    pages = json.loads(page_path.read_text(encoding="utf-8"))
    pages[0]["translated_text"] = "页文件里没提交的内容。"
    # 和真实写回一样换 inode(快照是硬链接,原地改写会连快照一起改掉)。
    page_path.unlink()
    page_path.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")

    result = revise_translation_item(tmp_path, _REQUEST)

    assert result["outcome"] == "committed" and result["generation"] == 8
    _assert_publication_consistent(translated)
    assert _item_text(translated) == NEW_TEXT


def test_stale_intent_from_another_generation_is_discarded(tmp_path):
    translated = _build_job(tmp_path)
    (translated / revision_module.TRANSLATION_REVISION_INTENT_FILE_NAME).write_text(json.dumps({
        "schema": "translation_revision_intent_v1",
        "revision_id": "rev-stale",
        "previous_generation": 3,
        "new_generation": 4,
        "previous_checkpoint_sha256": "0" * 64,
        "record": {"revision_id": "rev-stale", "page_hashes": {"page-001-deepseek.json": "1" * 64}},
    }), encoding="utf-8")

    result = revise_translation_item(tmp_path, _REQUEST)

    assert result["generation"] == 8
    assert not (translated / revision_module.TRANSLATION_REVISION_INTENT_FILE_NAME).exists()
    assert [r["revision_id"] for r in load_item_revisions(translated, "p001-b001")] == [
        result["revision"]["revision_id"]
    ]


_SLOW_REVISE = textwrap.dedent("""
    import sys, time
    from pathlib import Path
    from retainpdf_translation.workflow.checkpoint.store import CheckpointStore
    from retainpdf_translation.public import RevisionRequest, revise_translation_item

    real_save = CheckpointStore.save

    def slow_save(self, payload):
        # 页文件已写、checkpoint 还没写:正是修订最脆弱的那一段。
        Path(sys.argv[2]).write_text("in-window")
        time.sleep(30)
        real_save(self, payload)

    CheckpointStore.save = slow_save
    revise_translation_item(Path(sys.argv[1]), RevisionRequest(
        item_id="p001-b001", translated_text=sys.argv[3], source="user"))
""")


def _start_slow_revise(root: Path) -> tuple[subprocess.Popen, Path]:
    marker = root / "in-window.marker"
    env = {**os.environ, "PYTHONPATH": os.pathsep.join(sys.path)}
    child = subprocess.Popen(
        [sys.executable, "-c", _SLOW_REVISE, str(root), str(marker), NEW_TEXT],
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    deadline = time.time() + 30
    while not marker.exists():
        assert child.poll() is None, child.stderr.read().decode()
        assert time.time() < deadline, "revise never reached the checkpoint write"
        time.sleep(0.02)
    return child, marker


def test_real_sigkill_between_page_write_and_checkpoint_is_recovered(tmp_path):
    translated = _build_job(tmp_path)
    child, _marker = _start_slow_revise(tmp_path)
    child.kill()
    child.wait()
    # 现场:页文件领先 checkpoint。
    on_disk = json.loads((translated / "page-001-deepseek.json").read_text(encoding="utf-8"))
    assert on_disk[0]["translated_text"] == NEW_TEXT and _checkpoint(translated)["generation"] == 7

    result = revise_translation_item(tmp_path, _REQUEST)

    assert result["generation"] == 8
    _assert_publication_consistent(translated)
    assert len(load_item_revisions(translated, "p001-b001")) == 1


def test_sigterm_rolls_the_revision_back_in_process(tmp_path):
    translated = _build_job(tmp_path)
    before = _snapshot(translated)
    child, _marker = _start_slow_revise(tmp_path)
    child.send_signal(signal.SIGTERM)
    child.wait(timeout=20)
    # 子命令入口装了 SIGTERM 处理:走进程内回滚,不是被信号直接带走。
    assert _snapshot(translated) == before
