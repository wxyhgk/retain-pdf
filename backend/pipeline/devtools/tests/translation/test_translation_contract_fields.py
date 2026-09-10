import json
import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.core.item_reader import item_block_class
from retainpdf_pipeline.translate.core.item_reader import item_layout_role
from retainpdf_pipeline.translate.core.item_reader import item_is_algorithm_like
from retainpdf_pipeline.translate.core.item_reader import item_is_metadata_like
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_heading_like
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_compatible
from retainpdf_pipeline.translate.core.item_reader import item_policy_translate
from retainpdf_pipeline.translate.core.item_reader import item_semantic_role
from retainpdf_pipeline.translate.core.item_reader import item_structure_role
from retainpdf_pipeline.translate.core.ocr.models import TextItem
from retainpdf_pipeline.translate.artifacts.status import is_allowed_untranslated
import retainpdf_pipeline.translate.core.payload.translations as translations_module
from retainpdf_pipeline.translate.core.payload.translations import ensure_translation_template
from retainpdf_pipeline.translate.core.payload.translations import export_translation_template
from retainpdf_pipeline.translate.core.payload.translations import load_translations


def _text_item(item_id: str, text: str = "Body paragraph") -> TextItem:
    return TextItem(
        item_id=item_id,
        page_idx=0,
        block_idx=1,
        block_type="text",
        bbox=[0, 0, 10, 10],
        text=text,
        segments=[],
        lines=[],
        metadata={},
        block_kind="text",
        layout_role="paragraph",
        semantic_role="body",
        structure_role="body",
        policy_translate=True,
        reading_order=7,
        raw_block_type="paragraph",
        normalized_sub_type="body",
    )


def test_item_reader_prefers_top_level_contract_fields_over_metadata() -> None:
    item = {
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "metadata": {
            "layout_role": "caption",
            "semantic_role": "reference",
            "structure_role": "reference_entry",
            "policy_translate": False,
        },
    }

    assert item_layout_role(item) == "paragraph"
    assert item_semantic_role(item) == "body"
    assert item_structure_role(item) == "body"
    assert item_policy_translate(item) is True


def test_item_reader_contract_helpers_prefer_canonical_roles_over_legacy_subtype() -> None:
    item = {
        "layout_role": "heading",
        "semantic_role": "reference",
        "structure_role": "reference_heading",
        "block_type": "text",
        "block_kind": "text",
        "normalized_sub_type": "algorithm",
        "metadata": {
            "layout_role": "paragraph",
            "semantic_role": "",
            "structure_role": "body",
            "normalized_sub_type": "",
        },
    }

    assert item_is_reference_heading_like(item) is True
    assert item_is_algorithm_like(item) is False
    assert item_is_algorithm_like({"block_type": "text", "normalized_sub_type": "algorithm"}) is True


def test_export_translation_template_promotes_contract_fields_to_top_level() -> None:
    item = TextItem(
        item_id="p001-b001",
        page_idx=0,
        block_idx=1,
        block_type="text",
        bbox=[0, 0, 10, 10],
        text="Body paragraph",
        segments=[],
        lines=[],
        metadata={
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy_translate": True,
        },
        block_kind="text",
        layout_role="paragraph",
        semantic_role="body",
        structure_role="body",
        policy_translate=True,
        reading_order=7,
        raw_block_type="paragraph",
        normalized_sub_type="body",
    )

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "page-001-deepseek.json"
        export_translation_template([item], path, page_idx=0, math_mode="direct_typst")
        payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload[0]["block_kind"] == "text"
    assert payload[0]["block_class"] == "body"
    assert payload[0]["layout_role"] == "paragraph"
    assert payload[0]["semantic_role"] == "body"
    assert payload[0]["structure_role"] == "body"
    assert payload[0]["policy_translate"] is True
    assert payload[0]["reading_order"] == 7
    assert payload[0]["raw_block_type"] == "paragraph"
    assert payload[0]["normalized_sub_type"] == "body"


def test_ensure_translation_template_backfills_contract_fields_without_metadata_roles() -> None:
    item = TextItem(
        item_id="p001-b001",
        page_idx=0,
        block_idx=1,
        block_type="text",
        bbox=[0, 0, 10, 10],
        text="Body paragraph",
        segments=[],
        lines=[],
        metadata={},
        block_kind="text",
        layout_role="paragraph",
        semantic_role="body",
        structure_role="body",
        policy_translate=True,
        reading_order=7,
        raw_block_type="paragraph",
        normalized_sub_type="body",
    )

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "page-001-deepseek.json"
        path.write_text(
            json.dumps(
                [
                    {
                        "item_id": "p001-b001",
                        "page_idx": 0,
                        "block_idx": 1,
                        "block_type": "text",
                        "bbox": [0, 0, 10, 10],
                        "source_text": "Body paragraph",
                        "protected_source_text": "Body paragraph",
                        "formula_map": [],
                        "protected_map": [],
                        "protected_translated_text": "",
                        "translated_text": "",
                    }
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        ensure_translation_template([item], path, page_idx=0, math_mode="direct_typst")
        payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload[0]["block_kind"] == "text"
    assert payload[0]["block_class"] == "body"
    assert payload[0]["layout_role"] == "paragraph"
    assert payload[0]["semantic_role"] == "body"
    assert payload[0]["structure_role"] == "body"
    assert payload[0]["policy_translate"] is True
    assert payload[0]["should_translate"] is True


def test_ensure_translation_template_rebuilds_legacy_payload_instead_of_upgrading_in_place() -> None:
    item = TextItem(
        item_id="p001-b001",
        page_idx=0,
        block_idx=1,
        block_type="text",
        bbox=[0, 0, 10, 10],
        text="Body paragraph",
        segments=[],
        lines=[],
        metadata={},
        block_kind="text",
        layout_role="paragraph",
        semantic_role="body",
        structure_role="body",
        policy_translate=True,
        reading_order=7,
        raw_block_type="paragraph",
        normalized_sub_type="body",
    )

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "page-001-deepseek.json"
        path.write_text(
            json.dumps(
                [
                    {
                        "item_id": "legacy-item",
                        "translated_text": "legacy text",
                    }
                ],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        ensure_translation_template([item], path, page_idx=0, math_mode="direct_typst")
        payload = json.loads(path.read_text(encoding="utf-8"))

    assert payload[0]["item_id"] == "p001-b001"
    assert payload[0]["block_kind"] == "text"
    assert payload[0]["block_class"] == "body"
    assert payload[0]["raw_block_type"] == "paragraph"
    assert payload[0]["normalized_sub_type"] == "body"


def test_ensure_translation_template_rebuilds_corrupt_json(tmp_path) -> None:
    path = tmp_path / "page-001-deepseek.json"
    path.write_text("{not json", encoding="utf-8")
    item = _text_item("p001-b001", "Recovered paragraph")

    ensure_translation_template([item], path, page_idx=0, math_mode="direct_typst")
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert [record["item_id"] for record in payload] == ["p001-b001"]
    assert payload[0]["source_text"] == "Recovered paragraph"


def test_ensure_translation_template_prunes_removed_records(tmp_path) -> None:
    path = tmp_path / "page-001-deepseek.json"
    current_item = _text_item("p001-b001", "Current paragraph")
    removed_item = _text_item("p001-b999", "Removed paragraph")
    export_translation_template([current_item, removed_item], path, page_idx=0, math_mode="direct_typst")

    ensure_translation_template([current_item], path, page_idx=0, math_mode="direct_typst")
    payload = json.loads(path.read_text(encoding="utf-8"))

    assert [record["item_id"] for record in payload] == ["p001-b001"]


def test_export_translation_template_uses_same_directory_atomic_replace(tmp_path, monkeypatch) -> None:
    path = tmp_path / "page-001-deepseek.json"
    item = _text_item("p001-b001")
    real_replace = translations_module.os.replace
    replace_calls: list[tuple[Path, Path]] = []

    def capture_replace(src, dst):
        replace_calls.append((Path(src), Path(dst)))
        real_replace(src, dst)

    monkeypatch.setattr(translations_module.os, "replace", capture_replace)

    export_translation_template([item], path, page_idx=0, math_mode="direct_typst")

    assert replace_calls
    tmp_path_used, target_path = replace_calls[-1]
    assert tmp_path_used.parent == path.parent
    assert target_path == path
    assert not tmp_path_used.exists()


def test_load_translations_rejects_payload_missing_strict_contract_fields(tmp_path) -> None:
    path = tmp_path / "page-001-deepseek.json"
    path.write_text(
        json.dumps(
            [
                {
                    "item_id": "p001-b001",
                    "translated_text": "译文",
                }
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    try:
        load_translations(path)
    except RuntimeError as exc:
        message = str(exc)
    else:
        raise AssertionError("expected strict contract validation failure")

    assert "missing strict contract fields" in message


def test_item_block_class_prefers_canonical_roles_over_legacy_sub_type() -> None:
    assert (
        item_block_class(
            {
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "abstract",
                "structure_role": "body",
                "normalized_sub_type": "body",
            }
        )
        == "title"
    )


def test_legacy_formula_class_is_allowed_to_remain_untranslated() -> None:
    assert is_allowed_untranslated(
        {
            "block_type": "text",
            "normalized_sub_type": "display_formula",
        }
    )


def test_reference_compatibility_prefers_canonical_roles_over_stale_aliases() -> None:
    canonical_reference = {
        "block_kind": "text",
        "block_class": "body",
        "semantic_role": "reference",
        "structure_role": "reference_entry",
    }
    legacy_reference = {
        "block_kind": "text",
        "raw_block_type": "ref_text",
    }
    conflicting_body = {
        "block_kind": "text",
        "block_class": "body",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "raw_block_type": "ref_text",
        "normalized_sub_type": "ref_text",
    }

    assert item_is_reference_compatible(canonical_reference) is True
    assert item_is_reference_compatible(legacy_reference) is True
    assert item_is_reference_compatible(conflicting_body) is False


def test_metadata_compatibility_prefers_canonical_class_over_stale_subtype() -> None:
    assert item_is_metadata_like({"block_kind": "text", "normalized_sub_type": "metadata"}) is True
    assert (
        item_is_metadata_like(
            {
                "block_kind": "text",
                "block_class": "body",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "normalized_sub_type": "metadata",
            }
        )
        is False
    )
