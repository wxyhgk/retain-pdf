import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.artifacts.io import aggregate_payload_diagnostics
from retainpdf_pipeline.translate.artifacts.status import enforce_no_blocking_untranslated
from retainpdf_pipeline.translate.public import blocking_untranslated_items


def test_aggregate_payload_diagnostics_keeps_items_with_final_status_only() -> None:
    translated_pages_map = {
        4: [
            {
                "item_id": "p004-b030",
                "final_status": "translated",
                "translated_text": "译文",
            }
        ]
    }

    item_diagnostics, summary = aggregate_payload_diagnostics(translated_pages_map)

    assert len(item_diagnostics) == 1
    assert item_diagnostics[0]["item_id"] == "p004-b030"
    assert item_diagnostics[0]["page_idx"] == 4
    assert item_diagnostics[0]["final_status"] == "translated"
    assert summary["status_summary"]["translated"] == 1


def test_aggregate_payload_diagnostics_whitelists_intentional_keep_origin_items() -> None:
    translated_pages_map = {
        5: [
            {
                "item_id": "p006-b015",
                "final_status": "kept_origin",
                "skip_reason": "skip_display_formula",
            },
            {
                "item_id": "p006-b016",
                "final_status": "kept_origin",
                "skip_reason": "skip_model_keep_origin",
            },
        ]
    }

    _item_diagnostics, summary = aggregate_payload_diagnostics(translated_pages_map)

    assert summary["status_summary"]["kept_origin"] == 2
    assert summary["unresolved_translation_count"] == 0
    assert blocking_untranslated_items(translated_pages_map) == []


def test_translation_export_gate_allows_skipped_formula_blocks() -> None:
    translated_pages_map = {
        5: [
            {
                "item_id": "p005-b006",
                "block_kind": "formula",
                "block_type": "formula",
                "policy_translate": False,
                "should_translate": False,
                "classification_label": "skip_interline_equation",
                "skip_reason": "skip_interline_equation",
                "final_status": "kept_origin",
                "translated_text": "",
                "protected_source_text": r"\\mathrm{SMA}_{t}=...",
            }
        ]
    }

    _item_diagnostics, summary = aggregate_payload_diagnostics(translated_pages_map)

    assert summary["status_summary"]["kept_origin"] == 1
    assert summary["unresolved_translation_count"] == 0
    assert blocking_untranslated_items(translated_pages_map) == []


def test_blocking_untranslated_items_keeps_non_whitelisted_failures_blocking() -> None:
    translated_pages_map = {
        1: [
            {
                "item_id": "p002-b001",
                "final_status": "kept_origin",
                "translation_diagnostics": {
                    "route_path": ["block_level", "direct_typst"],
                    "degradation_reason": "validation",
                },
            }
        ]
    }

    blocked = blocking_untranslated_items(translated_pages_map)

    assert len(blocked) == 1
    assert blocked[0]["item_id"] == "p002-b001"


def test_translated_status_without_translation_artifact_is_blocking() -> None:
    translated_pages_map = {
        1: [
            {
                "item_id": "p002-b002",
                "final_status": "translated",
                "translated_text": "",
                "translation_diagnostics": {
                    "route_path": ["block_level", "plain_text"],
                    "final_status": "translated",
                },
            }
        ]
    }

    _item_diagnostics, summary = aggregate_payload_diagnostics(translated_pages_map)
    blocked = blocking_untranslated_items(translated_pages_map)

    assert summary["unresolved_translation_count"] == 1
    assert summary["unresolved_items"][0]["item_id"] == "p002-b002"
    assert len(blocked) == 1
    assert blocked[0]["item_id"] == "p002-b002"
    try:
        enforce_no_blocking_untranslated(translated_pages_map)
    except RuntimeError as exc:
        assert "translation export gate blocked" in str(exc)
        assert "p2:p002-b002" in str(exc)
    else:
        raise AssertionError("expected hard gate to reject empty translated item")


def test_repaired_item_translation_artifact_overrides_stale_failed_diagnostics() -> None:
    translated_pages_map = {
        1: [
            {
                "item_id": "p002-b003",
                "final_status": "translated",
                "translated_text": "已经修复的译文",
                "translation_diagnostics": {
                    "route_path": ["block_level", "direct_typst", "failed"],
                    "degradation_reason": "protocol_shell_repeated",
                    "final_status": "failed",
                },
            }
        ]
    }

    item_diagnostics, summary = aggregate_payload_diagnostics(translated_pages_map)
    blocked = blocking_untranslated_items(translated_pages_map)

    assert summary["status_summary"]["translated"] == 1
    assert summary["unresolved_translation_count"] == 0
    assert item_diagnostics[0]["final_status"] == "translated"
    assert blocked == []


def test_garbled_reconstructed_item_with_stale_failed_item_status_is_not_blocking() -> None:
    translated_pages_map = {
        1: [
            {
                "item_id": "p002-b004",
                "final_status": "failed",
                "translated_text": "乱码重建后的译文",
                "classification_label": "llm_reconstructed_garbled",
                "translation_diagnostics": {
                    "route_path": ["block_level", "direct_typst", "validation", "failed"],
                    "degradation_reason": "protocol_shell_repeated",
                    "final_status": "failed",
                },
            }
        ]
    }

    item_diagnostics, summary = aggregate_payload_diagnostics(translated_pages_map)
    blocked = blocking_untranslated_items(translated_pages_map)

    assert summary["status_summary"]["translated"] == 1
    assert summary["unresolved_translation_count"] == 0
    assert item_diagnostics[0]["final_status"] == "translated"
    assert blocked == []


def test_aggregate_payload_diagnostics_adds_debug_location_fields() -> None:
    translated_pages_map = {
        2: [
            {
                "item_id": "p003-b004",
                "math_mode": "direct_typst",
                "final_status": "failed",
                "translation_diagnostics": {
                    "route_path": ["block_level", "direct_typst"],
                    "request_label": "book: batch 1/2 item 1/3",
                    "provider_family": "deepseek_official",
                    "error_trace": [{"type": "validation", "message": "empty translation output"}],
                },
            }
        ]
    }

    item_diagnostics, _summary = aggregate_payload_diagnostics(translated_pages_map)

    assert item_diagnostics[0]["provider"] == "deepseek_official"
    assert item_diagnostics[0]["prompt_mode"] == "direct_typst"
    assert item_diagnostics[0]["request_label"] == "book: batch 1/2 item 1/3"
    assert item_diagnostics[0]["raw_excerpt"] == "empty translation output"
