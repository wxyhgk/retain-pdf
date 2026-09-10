from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema.markdown_fallback import (
    materialize_document_markdown_fallback,
    render_document_markdown,
)


def _document() -> dict:
    return {
        "schema": "normalized_document_v1",
        "schema_version": "1.1",
        "document_id": "markdown-fallback",
        "page_count": 1,
        "source": {"provider": "local"},
        "derived": {},
        "markers": {},
        "assets": {
            "page-1/figure.png": {
                "kind": "image",
                "uri": "md/images/page-1/figure.png",
                "source": "local",
            }
        },
        "pages": [
            {
                "page_index": 0,
                "page": 1,
                "blocks": [
                    _block("table", 4, "<table><tr><td>A</td><td>1</td></tr></table>"),
                    _block("text", 1, "Body after title."),
                    _block("formula", 3, "E = mc^2", sub_type="display_formula"),
                    _block("text", 0, "Canonical Title", layout_role="title", sub_type="title"),
                    _block(
                        "image",
                        5,
                        '<img src="figure.png" alt="Pipeline [figure]">',
                        asset_ids=["page-1/figure.png"],
                    ),
                    _block("text", 2, "Second paragraph."),
                ],
            }
        ],
    }


def _block(
    kind: str,
    reading_order: int,
    text: str,
    *,
    layout_role: str = "paragraph",
    sub_type: str = "body",
    asset_ids: list[str] | None = None,
) -> dict:
    content = {"kind": kind, "text": text}
    if asset_ids:
        content["asset_id"] = asset_ids[0]
        content["asset_ids"] = asset_ids
    return {
        "order": reading_order,
        "reading_order": reading_order,
        "content": content,
        "layout_role": layout_role,
        "structure_role": "title" if layout_role == "title" else "body",
        "sub_type": sub_type,
    }


def test_render_document_markdown_uses_canonical_reading_order_and_block_semantics() -> None:
    markdown = render_document_markdown(_document())

    expected_fragments = [
        "# Canonical Title",
        "Body after title.",
        "Second paragraph.",
        "$$\nE = mc^2\n$$",
        "<table><tr><td>A</td><td>1</td></tr></table>",
        "![Pipeline \\[figure\\]](images/page-1/figure.png)",
    ]
    positions = [markdown.index(fragment) for fragment in expected_fragments]
    assert positions == sorted(positions)
    assert markdown.endswith("\n")


def test_render_document_markdown_uses_canonical_table_html_when_text_is_empty() -> None:
    document = _document()
    table = document["pages"][0]["blocks"][0]
    table["content"]["text"] = ""
    table["content"]["table_html"] = "<table><tr><td>MinerU</td></tr></table>"

    markdown = render_document_markdown(document)

    assert "<table><tr><td>MinerU</td></tr></table>" in markdown


def test_materialize_fallback_preserves_existing_provider_markdown(tmp_path: Path) -> None:
    normalized_json_path = tmp_path / "ocr" / "normalized" / "document.v1.json"
    normalized_json_path.parent.mkdir(parents=True)
    normalized_json_path.write_text(json.dumps(_document()), encoding="utf-8")
    provider_markdown_path = tmp_path / "md" / "full.md"
    provider_markdown_path.parent.mkdir(parents=True)
    provider_markdown_path.write_text("provider-owned markdown\n", encoding="utf-8")

    result = materialize_document_markdown_fallback(
        normalized_json_path=normalized_json_path,
        job_root=tmp_path,
    )

    assert result == provider_markdown_path
    assert provider_markdown_path.read_text(encoding="utf-8") == "provider-owned markdown\n"


def test_materialize_fallback_copies_canonical_asset_into_markdown_tree(tmp_path: Path) -> None:
    document = _document()
    document["assets"]["page-1/figure.png"]["uri"] = "ocr/provider-assets/figure.png"
    source_asset_path = tmp_path / "ocr" / "provider-assets" / "figure.png"
    source_asset_path.parent.mkdir(parents=True)
    source_asset_path.write_bytes(b"offline-image")
    normalized_json_path = tmp_path / "ocr" / "normalized" / "document.v1.json"
    normalized_json_path.parent.mkdir(parents=True)
    normalized_json_path.write_text(json.dumps(document), encoding="utf-8")

    result = materialize_document_markdown_fallback(
        normalized_json_path=normalized_json_path,
        job_root=tmp_path,
    )

    assert result == tmp_path / "md" / "full.md"
    assert "![Pipeline \\[figure\\]](images/page-1/figure.png)" in result.read_text(encoding="utf-8")
    assert (tmp_path / "md" / "images" / "page-1" / "figure.png").read_bytes() == b"offline-image"
