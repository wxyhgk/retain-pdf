from __future__ import annotations

import json
import sys
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.core.payload import save_translations
from retainpdf_pipeline.translate.workflow import book_flow
from retainpdf_pipeline.translate.workflow import execution_runner
from retainpdf_pipeline.translate.workflow.checkpoint import TRANSLATION_CHECKPOINT_FILE_NAME
from retainpdf_pipeline.translate.workflow.execution import TranslationExecutionRequest


def _request(tmp_path: Path) -> TranslationExecutionRequest:
    source_json = tmp_path / "document.v1.json"
    source_json.write_text("{}", encoding="utf-8")
    return TranslationExecutionRequest(
        source_json_path=source_json,
        output_dir=tmp_path / "job-a" / "translated",
        api_key="test-key",
        model="test-model",
        base_url="https://example.invalid/v1",
    )


def _plan():
    from retainpdf_pipeline.translate.artifacts.aggregator import TranslationRunDiagnostics
    return SimpleNamespace(
        data={},
        start=0,
        stop=0,
        page_indices=range(0, 1),
        glossary_entries=[],
        run_diagnostics=TranslationRunDiagnostics("fake", "fake", "https://example.invalid", 1, 1, 1),
        translation_context=object(),
        policy_config=SimpleNamespace(
            rule_profile_name="general_sci",
            custom_rules_text="",
            sci_cutoff_page_idx=None,
            sci_cutoff_block_idx=None,
            domain_guidance="",
            domain_context={},
        ),
    )


def _payload(translated_text: str) -> list[dict]:
    return [
        {
            "item_id": "p001-b001",
            "source_text": "source",
            "protected_source_text": "source",
            "translated_text": translated_text,
            "should_translate": True,
            "continuation_group": "",
            "formula_map": [],
            "protected_map": [],
        }
    ]


def _install_execution_stubs(monkeypatch, *, translated_text: str) -> None:
    def fake_book_flow(*, output_dir, checkpoint, **_kwargs):
        page_path = output_dir / "page-001-deepseek.json"
        page_payload = _payload(translated_text)
        save_translations(page_path, page_payload)
        paths = {0: page_path}
        pages = {0: page_payload}
        checkpoint.update("preparing", pages, paths)
        checkpoint.update("policy_ready", pages, paths)
        checkpoint.update("translating", pages, paths)
        checkpoint.update("repairing", pages, paths)
        checkpoint.update("validating", pages, paths)
        return pages, [{"total_items": 1, "translated_items": int(bool(translated_text))}]

    monkeypatch.setattr(book_flow, "translate_book_with_global_continuations", fake_book_flow)
    monkeypatch.setattr(execution_runner, "translation_run_diagnostics_scope", lambda _item: nullcontext())
    monkeypatch.setattr(execution_runner, "summarize_glossary_usage", lambda **_kwargs: {})
    monkeypatch.setattr(execution_runner, "aggregate_payload_diagnostics", lambda _pages: ({}, {}))
    monkeypatch.setattr(execution_runner, "build_translation_review", lambda **_kwargs: {})


def test_execution_commits_manifest_only_after_checkpoint_validation(tmp_path: Path, monkeypatch) -> None:
    request = _request(tmp_path)
    _install_execution_stubs(monkeypatch, translated_text="译文")
    monkeypatch.setattr(execution_runner, "blocking_untranslated_items", lambda _pages: [])

    plan = _plan()
    execution_runner.run_translation_execution_plan(request, plan)
    metrics = plan.run_diagnostics.build_summary()["checkpoint_timing"]
    assert metrics["persist_count"] >= 2  # Includes initialization and complete.
    assert metrics["persist_failed_count"] == 0

    manifest = json.loads(
        (request.output_dir / "translation-manifest.json").read_text(encoding="utf-8")
    )
    checkpoint = json.loads(
        (request.output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert manifest["status"] == "complete"
    assert checkpoint["status"] == "complete"
    assert checkpoint["phase"] == "committed"


def test_execution_does_not_publish_manifest_when_export_gate_blocks(tmp_path: Path, monkeypatch) -> None:
    request = _request(tmp_path)
    _install_execution_stubs(monkeypatch, translated_text="")
    monkeypatch.setattr(
        execution_runner,
        "blocking_untranslated_items",
        lambda _pages: [{"page_idx": 0, "item_id": "p001-b001", "reason": "empty"}],
    )

    with pytest.raises(RuntimeError, match="export gate blocked"):
        execution_runner.run_translation_execution_plan(request, _plan())

    assert not (request.output_dir / "translation-manifest.json").exists()
    checkpoint = json.loads(
        (request.output_dir / TRANSLATION_CHECKPOINT_FILE_NAME).read_text(encoding="utf-8")
    )
    assert checkpoint["status"] == "in_progress"
    assert checkpoint["phase"] == "validating"
