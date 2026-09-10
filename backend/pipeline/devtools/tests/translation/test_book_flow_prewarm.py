from __future__ import annotations

import sys
from pathlib import Path

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.workflow import book_flow


def test_initial_continuation_state_is_checkpointed_before_provider_review(
    monkeypatch, tmp_path: Path
) -> None:
    page_payloads = {0: [{"item_id": "p001-b001"}]}
    translation_paths = {0: tmp_path / "page-001-deepseek.json"}
    updates: list[tuple[str, str]] = []

    class RecordingCheckpoint:
        def update(self, phase, payloads, paths):
            del paths
            updates.append((phase, str(payloads[0][0].get("layout_mode", ""))))

    monkeypatch.setattr(
        book_flow,
        "load_page_payloads",
        lambda **kwargs: (translation_paths, page_payloads),
    )

    def initial_continuation_pass(**kwargs):
        kwargs["page_payloads"][0][0]["layout_mode"] = "double"

    def failed_provider_review(**kwargs):
        raise RuntimeError("upstream unavailable")

    monkeypatch.setattr(book_flow, "run_initial_continuation_pass", initial_continuation_pass)
    monkeypatch.setattr(book_flow, "run_continuation_review", failed_provider_review)

    with pytest.raises(RuntimeError, match="upstream unavailable"):
        book_flow.translate_book_with_global_continuations(
            data={},
            output_dir=tmp_path,
            page_indices=range(1),
            api_key="",
            batch_size=1,
            workers=1,
            model="",
            base_url="",
            mode="fast",
            classify_batch_size=1,
            skip_title_translation=False,
            sci_cutoff_page_idx=None,
            sci_cutoff_block_idx=None,
            checkpoint=RecordingCheckpoint(),
        )

    assert updates == [("preparing", ""), ("preparing", "double")]


def test_book_flow_does_not_start_render_prewarm_during_translation(monkeypatch, tmp_path: Path) -> None:
    page_payloads = {
        0: [
            {
                "item_id": "p001-b001",
                "protected_source_text": "source",
                "protected_translated_text": "",
            }
        ]
    }
    translation_paths = {0: tmp_path / "page-1.json"}

    def fake_load_page_payloads(**kwargs):
        return translation_paths, page_payloads

    def fake_translate_batch_stage(**kwargs):
        page_payloads[0][0]["protected_translated_text"] = "translated"

    def fake_load_translations(path):
        return page_payloads[0]

    monkeypatch.setattr(book_flow, "load_page_payloads", fake_load_page_payloads)
    monkeypatch.setattr(book_flow, "run_initial_continuation_pass", lambda **kwargs: None)
    monkeypatch.setattr(book_flow, "run_continuation_review", lambda **kwargs: None)
    monkeypatch.setattr(book_flow, "run_page_policy_stage", lambda **kwargs: 0)
    monkeypatch.setattr(book_flow, "finalize_orchestration_metadata_by_page", lambda payloads: None)
    monkeypatch.setattr(book_flow, "annotate_translation_context_windows", lambda payloads, mode: 0)
    monkeypatch.setattr(book_flow, "save_pages", lambda *args, **kwargs: None)
    monkeypatch.setattr(book_flow, "run_translation_batch_stage", fake_translate_batch_stage)
    monkeypatch.setattr(book_flow, "run_garbled_reconstruction_stage", lambda **kwargs: None)
    monkeypatch.setattr(book_flow, "run_agent_repair_stage", lambda **kwargs: {})
    monkeypatch.setattr(book_flow, "run_final_untranslated_recovery_stage", lambda **kwargs: {})
    monkeypatch.setattr(book_flow, "load_translations", fake_load_translations)
    monkeypatch.setattr(
        book_flow,
        "build_page_summaries",
        lambda translated_pages_map, translation_paths: [{"total_items": 1, "translated_items": 1}],
    )

    translated_pages_map, summaries = book_flow.translate_book_with_global_continuations(
        data={},
        output_dir=tmp_path,
        page_indices=range(1),
        api_key="",
        batch_size=1,
        workers=1,
        model="",
        base_url="",
        mode="fast",
        classify_batch_size=1,
        skip_title_translation=False,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
    )

    assert translated_pages_map[0][0]["protected_translated_text"] == "translated"
    assert summaries == [{"total_items": 1, "translated_items": 1}]
