from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.workflow.batching.plan import _build_translation_batches
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context


def _item(item_id: str, text: str, **overrides):
    item = {
        "item_id": item_id,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


def test_fast_path_keep_origin_is_removed_from_network_batches() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item("placeholder-only", "<f1-a7c/>"),
            _item("short-number", "12.5"),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"], ["short-number"]]
    assert [list(result)[0] for result in immediate] == ["placeholder-only"]
    assert all(list(result.values())[0]["decision"] == "keep_origin" for result in immediate)


def test_fast_path_keep_origin_skips_short_non_body_labels() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item(
                "caption-e",
                "E",
                block_type="image_caption",
                layout_zone="non_flow",
                metadata={"structure_role": "caption"},
            ),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    assert [list(result)[0] for result in immediate] == ["caption-e"]
    assert list(immediate[0].values())[0]["translation_diagnostics"]["degradation_reason"] == "short_non_body_label"


def test_fast_path_keep_origin_skips_editorial_metadata_tokens() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item(
                "crossmark",
                "CrossMark",
                block_type="text",
                metadata={"structure_role": "body"},
                page_idx=0,
                lines=[{"spans": [{"content": "CrossMark"}]}],
            ),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"], ["crossmark"]]
    assert immediate == []


def test_fast_path_keep_origin_skips_pure_email_fragments_only() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item(
                "email",
                "author@example.edu",
                block_type="text",
                metadata={"structure_role": "body"},
                page_idx=0,
                lines=[{"spans": [{"content": "author@example.edu"}]}],
            ),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    assert [list(result)[0] for result in immediate] == ["email"]
    assert list(immediate[0].values())[0]["translation_diagnostics"]["degradation_reason"] == "hard_metadata_fragment"


def test_fast_path_keep_origin_skips_protocol_hex_dump() -> None:
    context = build_translation_control_context()
    source = "Answer(slave-Base module):\n" + " ".join(["01", "03", "40", "FF", "00"] * 80)
    batches, immediate = _build_translation_batches(
        [
            _item("p182-b016", source),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )

    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    assert [list(result)[0] for result in immediate] == ["p182-b016"]
    assert list(immediate[0].values())[0]["translation_diagnostics"]["degradation_reason"] == "protocol_hex_dump"
