from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema.adapters import (
    adapt_payload_to_document_v1,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.label_catalog import (
    MINERU_MIDDLE_BLOCK_LABELS,
)
from retainpdf_pipeline.ocr.document_schema.providers import (
    PROVIDER_MINERU,
    PROVIDER_MINERU_CONTENT_LIST_V2,
)
from retainpdf_pipeline.ocr.document_schema.validator import (
    validate_document_payload,
)
from retainpdf_pipeline.ocr.mineru.artifacts import (
    materialize_mineru_page_assets,
    resolve_layout_json_path,
)

FIXTURES_DIR = Path(__file__).with_name("fixtures")


def _block(block_type: str, text: str = "", *, index: int = 0, **extra) -> dict:
    block = {
        "type": block_type,
        "bbox": [10, 10 + index * 20, 300, 28 + index * 20],
        "index": index,
        "angle": 0,
        **extra,
    }
    if text:
        block["lines"] = [
            {
                "bbox": block["bbox"],
                "spans": [
                    {
                        "type": "text",
                        "content": text,
                        "bbox": block["bbox"],
                        "score": 0.99,
                    }
                ],
            }
        ]
    return block


def _payload(*blocks: dict, discarded_blocks: list[dict] | None = None) -> dict:
    return {
        "_backend": "vlm",
        "_version_name": "3.1.0",
        "pdf_info": [
            {
                "page_idx": 0,
                "page_size": [595.0, 842.0],
                "para_blocks": list(blocks),
                "discarded_blocks": discarded_blocks or [],
            }
        ],
    }


def _adapt(payload: dict) -> dict:
    return adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_MINERU,
        document_id="mineru-test",
        source_json_path=Path("middle.json"),
    )


def test_mineru_catalog_covers_current_official_block_type_values() -> None:
    expected = {
        "image",
        "table",
        "chart",
        "image_body",
        "table_body",
        "chart_body",
        "caption",
        "image_caption",
        "table_caption",
        "chart_caption",
        "algorithm_caption",
        "footnote",
        "image_footnote",
        "table_footnote",
        "chart_footnote",
        "text",
        "title",
        "interline_equation",
        "equation",
        "list",
        "index",
        "discarded",
        "code",
        "code_body",
        "code_caption",
        "code_footnote",
        "algorithm",
        "ref_text",
        "phonetic",
        "header",
        "footer",
        "page_number",
        "aside_text",
        "page_footnote",
        "abstract",
        "doc_title",
        "paragraph_title",
        "vertical_text",
        "header_image",
        "footer_image",
        "formula_number",
    }

    assert set(MINERU_MIDDLE_BLOCK_LABELS) == expected


def test_committed_mineru_middle_v3_fixture_covers_visual_and_text_contracts() -> None:
    fixture_path = FIXTURES_DIR / "mineru_middle_v3.golden.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_MINERU,
        document_id="mineru-v3-golden",
        source_json_path=fixture_path,
    )
    report = validate_document_payload(document)

    assert report is None
    blocks = document["pages"][0]["blocks"]
    by_label = {block["provenance"]["raw_label"]: block for block in blocks}
    assert by_label["abstract"]["layout_role"] == "paragraph"
    assert by_label["abstract"]["semantic_role"] == "abstract"
    assert by_label["image_body"]["content"]["asset_id"] == (
        "page-1/figures/figure 1.png"
    )
    assert by_label["image_caption"]["metadata"]["caption_target_block_id"] == (
        by_label["image_body"]["block_id"]
    )
    assert by_label["image_footnote"]["metadata"]["footnote_target_block_id"] == (
        by_label["image_body"]["block_id"]
    )
    assert by_label["table_body"]["metadata"]["provider_table_html_available"] is True
    assert by_label["table_body"]["content"]["table_html"] == (
        "<table><tr><td>A</td></tr></table>"
    )
    assert by_label["table_caption"]["metadata"]["caption_target_block_id"] == (
        by_label["table_body"]["block_id"]
    )
    assert [segment["type"] for segment in by_label["text"]["segments"]] == [
        "text",
        "inline_formula",
        "text",
    ]
    assert all(
        segment["bbox_precision"] == "provider_layout"
        for segment in by_label["text"]["segments"]
    )
    assert by_label["list"]["content"]["line_texts"] == [
        "First list item",
        "Second list item",
    ]
    assert document["derived"]["provider_signals"]["unknown_block_types"] == []
    assert set(document["assets"]) == {
        "page-1/figures/figure 1.png",
        "page-1/tables/table-1.png",
    }


def test_mineru_abstract_uses_body_text_behavior_not_title_layout() -> None:
    document = _adapt(
        _payload(
            _block("doc_title", "Paper title", index=0),
            _block("abstract", "Abstract body text", index=1),
        )
    )
    validate_document_payload(document)

    title, abstract = document["pages"][0]["blocks"]
    assert title["layout_role"] == "title"
    assert title["structure_role"] == "document_title"
    assert title["policy"]["translate"] is True
    assert abstract["content"]["text"] == "Abstract body text"
    assert abstract["layout_role"] == "paragraph"
    assert abstract["semantic_role"] == "abstract"
    assert abstract["structure_role"] == "body"
    assert abstract["policy"] == {
        "translate": True,
        "translate_reason": "provider_body_whitelist:abstract",
    }


def test_mineru_visual_container_is_not_duplicated_and_relations_target_body() -> None:
    image_body = _block("image_body", index=1)
    image_body["lines"] = [
        {
            "bbox": image_body["bbox"],
            "spans": [
                {
                    "type": "image",
                    "image_path": "images/figure-1.jpg",
                    "bbox": image_body["bbox"],
                }
            ],
        }
    ]
    image = _block(
        "image",
        index=1,
        blocks=[
            image_body,
            _block("image_caption", "Figure 1. Example", index=2),
            _block("image_footnote", "Source note", index=3),
        ],
    )

    document = _adapt(_payload(image))
    validate_document_payload(document)
    blocks = document["pages"][0]["blocks"]

    assert [block["provenance"]["raw_label"] for block in blocks] == [
        "image_body",
        "image_caption",
        "image_footnote",
    ]
    assert blocks[0]["content"]["kind"] == "image"
    assert blocks[0]["metadata"]["provider_image_paths"] == ["images/figure-1.jpg"]
    assert blocks[0]["content"]["asset_id"] == "page-1/figure-1.jpg"
    assert document["assets"]["page-1/figure-1.jpg"]["uri"] == (
        "md/images/page-1/figure-1.jpg"
    )
    assert document["assets"]["page-1/figure-1.jpg"]["caption"] == (
        "Figure 1. Example"
    )
    assert blocks[1]["metadata"]["caption_target_block_id"] == blocks[0]["block_id"]
    assert blocks[1]["content"]["asset_id"] == blocks[0]["content"]["asset_id"]
    assert blocks[2]["metadata"]["footnote_target_block_id"] == blocks[0]["block_id"]
    assert blocks[0]["content"]["footnotes"] == ["Source note"]
    assert blocks[0]["content"]["footnote_block_ids"] == [blocks[2]["block_id"]]
    signals = document["derived"]["provider_signals"]
    assert signals["structural_containers_not_emitted"] == 1
    assert signals["raw_block_type_counts"]["image"] == 1
    assert signals["unknown_block_types"] == []


def test_mineru_unsafe_image_path_is_not_exposed_as_canonical_asset() -> None:
    image_body = _block("image_body", index=0)
    image_body["lines"] = [
        {
            "bbox": image_body["bbox"],
            "spans": [
                {
                    "type": "image",
                    "image_path": "../../outside.png",
                    "bbox": image_body["bbox"],
                }
            ],
        }
    ]

    document = _adapt(_payload(image_body))

    assert "asset_id" not in document["pages"][0]["blocks"][0]["content"]
    assert document["assets"] == {}


def test_mineru_bundle_image_is_materialized_for_reader_page_asset_root(
    tmp_path: Path,
) -> None:
    raw_dir = tmp_path / "unpacked"
    source_image = raw_dir / "images" / "nested" / "figure 1.jpg"
    source_image.parent.mkdir(parents=True)
    source_image.write_bytes(b"mineru-image")
    layout_path = raw_dir / "paper_middle.json"
    layout_path.write_text("{}", encoding="utf-8")

    image_body = _block("image_body", index=0)
    image_body["lines"] = [
        {
            "bbox": image_body["bbox"],
            "spans": [
                {
                    "type": "image",
                    "image_path": "images/nested/figure 1.jpg",
                    "bbox": image_body["bbox"],
                }
            ],
        }
    ]
    document = _adapt(_payload(image_body))
    markdown_images_dir = tmp_path / "job" / "md" / "images"

    report = materialize_mineru_page_assets(
        document=document,
        provider_raw_dir=raw_dir,
        layout_json_path=layout_path,
        markdown_images_dir=markdown_images_dir,
    )

    target = markdown_images_dir / "page-1" / "nested" / "figure 1.jpg"
    assert target.read_bytes() == b"mineru-image"
    assert report == {"requested": 1, "materialized": 1, "missing": 0}
    metadata = document["pages"][0]["blocks"][0]["metadata"]
    assert metadata["asset_resolved"] is True
    assert metadata["asset_resolved_count"] == 1


def test_mineru_bundle_image_symlink_outside_raw_root_is_not_materialized(
    tmp_path: Path,
) -> None:
    raw_dir = tmp_path / "unpacked"
    images_dir = raw_dir / "images"
    images_dir.mkdir(parents=True)
    outside = tmp_path / "outside.png"
    outside.write_bytes(b"outside")
    (images_dir / "linked.png").symlink_to(outside)
    layout_path = raw_dir / "paper_middle.json"
    layout_path.write_text("{}", encoding="utf-8")

    image_body = _block("image_body", index=0)
    image_body["lines"] = [
        {
            "bbox": image_body["bbox"],
            "spans": [
                {
                    "type": "image",
                    "image_path": "images/linked.png",
                    "bbox": image_body["bbox"],
                }
            ],
        }
    ]
    document = _adapt(_payload(image_body))
    markdown_images_dir = tmp_path / "job" / "md" / "images"

    report = materialize_mineru_page_assets(
        document=document,
        provider_raw_dir=raw_dir,
        layout_json_path=layout_path,
        markdown_images_dir=markdown_images_dir,
    )

    assert report == {"requested": 1, "materialized": 0, "missing": 1}
    assert not (markdown_images_dir / "page-1" / "linked.png").exists()


def test_mineru_list_aggregates_children_and_discarded_blocks_are_preserved() -> None:
    list_block = _block(
        "list",
        index=2,
        sub_type="text",
        blocks=[
            _block("text", "First item", index=2),
            _block("text", "Second item", index=3),
        ],
    )
    header = _block("header", "Journal header", index=0)

    document = _adapt(_payload(list_block, discarded_blocks=[header]))
    validate_document_payload(document)
    header_block, normalized_list = document["pages"][0]["blocks"]

    assert header_block["provenance"]["raw_path"].endswith("discarded_blocks/0")
    assert header_block["policy"]["translate"] is False
    assert normalized_list["provenance"]["raw_label"] == "list"
    assert normalized_list["content"]["text"] == "First item Second item"
    assert normalized_list["content"]["line_texts"] == ["First item", "Second item"]
    assert normalized_list["layout_role"] == "list_item"
    assert normalized_list["policy"]["translate"] is True
    assert len(document["pages"][0]["blocks"]) == 2


def test_mineru_unknown_text_label_is_reported_and_not_translated() -> None:
    document = _adapt(
        _payload(_block("future_provider_label", "Unclassified", index=0))
    )
    block = document["pages"][0]["blocks"][0]

    assert block["content"]["kind"] == "text"
    assert block["semantic_role"] == "metadata"
    assert block["policy"]["translate"] is False
    assert document["derived"]["provider_signals"]["unknown_block_types"] == [
        "future_provider_label"
    ]


def test_mineru_content_list_v2_projects_current_common_types() -> None:
    fixture_path = FIXTURES_DIR / "mineru_content_list_v2.golden.json"
    payload = json.loads(fixture_path.read_text(encoding="utf-8"))

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_MINERU_CONTENT_LIST_V2,
        document_id="mineru-v2-test",
        source_json_path=fixture_path,
    )
    validate_document_payload(document)
    heading, body, equation, footnote = document["pages"][0]["blocks"]

    assert heading["layout_role"] == "heading"
    assert body["content"]["kind"] == "text"
    assert body["policy"]["translate"] is True
    assert [segment["type"] for segment in body["segments"]] == [
        "text",
        "inline_formula",
        "text",
    ]
    assert equation["content"]["kind"] == "formula"
    assert equation["segments"][0]["type"] == "formula"
    assert equation["policy"]["translate"] is False
    assert footnote["layout_role"] == "footnote"
    assert footnote["policy"]["translate"] is False


def test_mineru_artifact_resolver_accepts_current_middle_filename(
    tmp_path: Path,
) -> None:
    nested = tmp_path / "paper"
    nested.mkdir()
    middle_json = nested / "paper_middle.json"
    middle_json.write_text("{}", encoding="utf-8")

    assert resolve_layout_json_path(tmp_path) == middle_json


def test_mineru_artifact_resolver_rejects_ambiguous_middle_files(
    tmp_path: Path,
) -> None:
    (tmp_path / "first_middle.json").write_text("{}", encoding="utf-8")
    (tmp_path / "second_middle.json").write_text("{}", encoding="utf-8")

    with pytest.raises(RuntimeError, match="multiple middle.json candidates"):
        resolve_layout_json_path(tmp_path)
