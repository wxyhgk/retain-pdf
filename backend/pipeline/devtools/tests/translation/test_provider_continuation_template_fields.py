import tempfile
from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.defaults import default_block_continuation_hint
from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.translate.core.ocr.json_extractor import extract_text_items
from retainpdf_pipeline.translate.core.ocr.models import TextItem
from retainpdf_pipeline.translate.core.payload.translations import export_translation_template
from retainpdf_pipeline.translate.core.payload.translations import load_translations
from retainpdf_pipeline.translate.services.continuation import state


def test_generic_provider_continuation_hint_flows_through_extractor_and_template() -> None:
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 240.0,
                    "height": 200.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [0, 0, 100, 20],
                            "text": "left column sentence",
                            "lines": [
                                {
                                    "bbox": [0, 0, 100, 20],
                                    "spans": [
                                        {
                                            "type": "text",
                                            "raw_type": "text",
                                            "text": "left column sentence",
                                            "bbox": [0, 0, 100, 20],
                                        }
                                    ],
                                }
                            ],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "continuation_hint": {
                                "source": "provider",
                                "group_id": "provider-generic-group-1",
                                "role": "head",
                                "scope": "intra_page",
                                "reading_order": 0,
                                "confidence": 0.91,
                            },
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [120, 0, 220, 20],
                            "text": "right column continuation",
                            "lines": [
                                {
                                    "bbox": [120, 0, 220, 20],
                                    "spans": [
                                        {
                                            "type": "text",
                                            "raw_type": "text",
                                            "text": "right column continuation",
                                            "bbox": [120, 0, 220, 20],
                                        }
                                    ],
                                }
                            ],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "continuation_hint": {
                                "source": "provider",
                                "group_id": "provider-generic-group-1",
                                "role": "tail",
                                "scope": "intra_page",
                                "reading_order": 1,
                                "confidence": 0.91,
                            },
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-continuation-doc",
        source_json_path=Path("/tmp/generic-continuation.json"),
    )

    blocks = adapted["pages"][0]["blocks"]
    assert blocks[0]["continuation_hint"]["group_id"] == "provider-generic-group-1"
    assert blocks[1]["continuation_hint"]["role"] == "tail"

    items = extract_text_items(adapted, 0)
    assert len(items) == 2
    assert items[0].metadata["continuation_hint"]["source"] == "provider"

    with tempfile.TemporaryDirectory() as tmp:
        translation_path = Path(tmp) / "page-001.json"
        export_translation_template(items, translation_path, page_idx=0)
        payload = load_translations(translation_path)

    assert payload[0]["ocr_continuation_group_id"] == "provider-generic-group-1"
    assert payload[1]["ocr_continuation_role"] == "tail"

    annotated = state.annotate_continuation_context(payload)

    assert annotated == 2
    assert payload[0]["continuation_decision"] == "provider_joined"
    assert payload[1]["continuation_decision"] == "provider_joined"
    assert payload[0]["continuation_group"] == "provider-generic-group-1"


def test_provider_layout_warning_fields_flow_through_template() -> None:
    item = TextItem(
        item_id="p001-b0001",
        page_idx=0,
        block_idx=0,
        block_type="text",
        bbox=[0, 0, 100, 20],
        text="merged text block",
        segments=[],
        lines=[],
        metadata={
            "continuation_hint": default_block_continuation_hint(),
            "provider_cross_column_merge_suspected": True,
            "provider_reading_order_unreliable": True,
            "provider_structure_unreliable": True,
            "provider_text_missing_but_bbox_present": False,
            "provider_peer_block_absorbed_text": True,
            "provider_suspected_peer_block_id": "p001-b0002",
            "provider_continuation_suppressed": True,
            "provider_continuation_suppressed_reason": "cross_column_merge_suspected",
            "provider_column_layout_mode": "double",
            "provider_column_index_guess": "left",
        },
    )
    with tempfile.TemporaryDirectory() as tmp:
        translation_path = Path(tmp) / "page-001.json"
        export_translation_template([item], translation_path, page_idx=0)
        payload = load_translations(translation_path)

    assert payload[0]["provider_cross_column_merge_suspected"] is True
    assert payload[0]["provider_reading_order_unreliable"] is True
    assert payload[0]["provider_structure_unreliable"] is True
    assert payload[0]["provider_text_missing_but_bbox_present"] is False
    assert payload[0]["provider_peer_block_absorbed_text"] is True
    assert payload[0]["provider_suspected_peer_block_id"] == "p001-b0002"
    assert payload[0]["provider_continuation_suppressed"] is True
    assert payload[0]["provider_continuation_suppressed_reason"] == "cross_column_merge_suspected"
    assert payload[0]["provider_column_layout_mode"] == "double"
    assert payload[0]["provider_column_index_guess"] == "left"
