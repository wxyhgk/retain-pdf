import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.translate.core.ocr.json_extractor import extract_text_items

def test_extract_text_items_keeps_publisher_metadata_tail_run_without_local_metadata_rule() -> None:
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 400.0,
                    "height": 800.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [20, 20, 200, 40],
                            "text": "Actual body paragraph",
                            "lines": [{"bbox": [20, 20, 200, 40], "spans": [{"type": "text", "raw_type": "text", "text": "Actual body paragraph", "bbox": [20, 20, 200, 40]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [220, 620, 380, 640],
                            "text": "doi:10.1186/1752-153X-6-70",
                            "lines": [{"bbox": [220, 620, 380, 640], "spans": [{"type": "text", "raw_type": "text", "text": "doi:10.1186/1752-153X-6-70", "bbox": [220, 620, 380, 640]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [220, 644, 390, 664],
                            "text": "Cite this article as: Example et al.",
                            "lines": [{"bbox": [220, 644, 390, 664], "spans": [{"type": "text", "raw_type": "text", "text": "Cite this article as: Example et al.", "bbox": [220, 644, 390, 664]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [220, 668, 390, 688],
                            "text": "Submit your manuscript here:",
                            "lines": [{"bbox": [220, 668, 390, 688], "spans": [{"type": "text", "raw_type": "text", "text": "Submit your manuscript here:", "bbox": [220, 668, 390, 688]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [220, 692, 390, 712],
                            "text": "http://example.com/manuscript/",
                            "lines": [{"bbox": [220, 692, 390, 712], "spans": [{"type": "text", "raw_type": "text", "text": "http://example.com/manuscript/", "bbox": [220, 692, 390, 712]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-body-metadata-tail-doc",
        source_json_path=Path("/tmp/generic-body-metadata-tail.json"),
    )

    items = extract_text_items(adapted, 0)

    assert [item.text for item in items] == [
        "Actual body paragraph",
        "doi:10.1186/1752-153X-6-70",
        "Cite this article as: Example et al.",
        "Submit your manuscript here:",
        "http://example.com/manuscript/",
    ]


def test_extract_text_items_keeps_short_publisher_metadata_singleton_without_local_metadata_rule() -> None:
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 300.0,
                    "height": 400.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [20, 20, 180, 40],
                            "text": "Actual body paragraph",
                            "lines": [{"bbox": [20, 20, 180, 40], "spans": [{"type": "text", "raw_type": "text", "text": "Actual body paragraph", "bbox": [20, 20, 180, 40]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [220, 20, 280, 36],
                            "text": "Open Access",
                            "lines": [{"bbox": [220, 20, 280, 36], "spans": [{"type": "text", "raw_type": "text", "text": "Open Access", "bbox": [220, 20, 280, 36]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-body-short-metadata-doc",
        source_json_path=Path("/tmp/generic-body-short-metadata.json"),
    )

    items = extract_text_items(adapted, 0)

    assert [item.text for item in items] == ["Actual body paragraph", "Open Access"]


def test_extract_text_items_skips_all_caps_badge_singleton() -> None:
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 300.0,
                    "height": 400.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [20, 20, 180, 40],
                            "text": "Actual body paragraph",
                            "lines": [{"bbox": [20, 20, 180, 40], "spans": [{"type": "text", "raw_type": "text", "text": "Actual body paragraph", "bbox": [20, 20, 180, 40]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [220, 20, 295, 36],
                            "text": "RESEARCH ARTICLE",
                            "lines": [{"bbox": [220, 20, 295, 36], "spans": [{"type": "text", "raw_type": "text", "text": "RESEARCH ARTICLE", "bbox": [220, 20, 295, 36]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-body-badge-doc",
        source_json_path=Path("/tmp/generic-body-badge.json"),
    )

    items = extract_text_items(adapted, 0)

    assert [item.text for item in items] == ["Actual body paragraph", "RESEARCH ARTICLE"]


def test_extract_text_items_skips_front_matter_author_line_between_title_and_abstract() -> None:
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 400.0,
                    "height": 500.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "title",
                            "bbox": [20, 20, 320, 56],
                            "text": "Document Title",
                            "lines": [{"bbox": [20, 20, 320, 56], "spans": [{"type": "text", "raw_type": "text", "text": "Document Title", "bbox": [20, 20, 320, 56]}]}],
                            "segments": [],
                            "tags": ["title"],
                            "derived": {"role": "title", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [20, 70, 260, 90],
                            "text": "Alice Smith and Bob Jones",
                            "lines": [{"bbox": [20, 70, 260, 90], "spans": [{"type": "text", "raw_type": "text", "text": "Alice Smith and Bob Jones", "bbox": [20, 70, 260, 90]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "heading",
                            "bbox": [20, 110, 100, 128],
                            "text": "Abstract",
                            "lines": [{"bbox": [20, 110, 100, 128], "spans": [{"type": "text", "raw_type": "text", "text": "Abstract", "bbox": [20, 110, 100, 128]}]}],
                            "segments": [],
                            "tags": ["heading"],
                            "derived": {"role": "heading", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "abstract",
                            "bbox": [20, 136, 360, 200],
                            "text": "This is the abstract body.",
                            "lines": [{"bbox": [20, 136, 360, 200], "spans": [{"type": "text", "raw_type": "text", "text": "This is the abstract body.", "bbox": [20, 136, 360, 200]}]}],
                            "segments": [],
                            "tags": ["abstract"],
                            "derived": {"role": "abstract", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-front-matter-author-doc",
        source_json_path=Path("/tmp/generic-front-matter-author.json"),
    )

    items = extract_text_items(adapted, 0)

    assert [item.text for item in items] == ["Abstract", "This is the abstract body."]


def test_extract_text_items_skips_keywords_line_singleton() -> None:
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 400.0,
                    "height": 500.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "abstract",
                            "bbox": [20, 20, 360, 80],
                            "text": "This is the abstract body.",
                            "lines": [{"bbox": [20, 20, 360, 80], "spans": [{"type": "text", "raw_type": "text", "text": "This is the abstract body.", "bbox": [20, 20, 360, 80]}]}],
                            "segments": [],
                            "tags": ["abstract"],
                            "derived": {"role": "abstract", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [20, 90, 320, 110],
                            "text": "Keywords: Indigo, DFT, CIS",
                            "lines": [{"bbox": [20, 90, 320, 110], "spans": [{"type": "text", "raw_type": "text", "text": "Keywords: Indigo, DFT, CIS", "bbox": [20, 90, 320, 110]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "heading",
                            "bbox": [20, 130, 120, 148],
                            "text": "Introduction",
                            "lines": [{"bbox": [20, 130, 120, 148], "spans": [{"type": "text", "raw_type": "text", "text": "Introduction", "bbox": [20, 130, 120, 148]}]}],
                            "segments": [],
                            "tags": ["heading"],
                            "derived": {"role": "heading", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-keywords-singleton-doc",
        source_json_path=Path("/tmp/generic-keywords-singleton.json"),
    )

    items = extract_text_items(adapted, 0)

    assert [item.text for item in items] == [
        "This is the abstract body.",
        "Keywords: Indigo, DFT, CIS",
        "Introduction",
    ]


def test_extract_text_items_keeps_ancillary_tail_sections_after_body_without_local_metadata_rule() -> None:
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 300.0,
                    "height": 500.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "heading",
                            "bbox": [20, 20, 120, 40],
                            "text": "Conclusions",
                            "lines": [{"bbox": [20, 20, 120, 40], "spans": [{"type": "text", "raw_type": "text", "text": "Conclusions", "bbox": [20, 20, 120, 40]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "heading", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [20, 44, 260, 84],
                            "text": "Actual concluding paragraph.",
                            "lines": [{"bbox": [20, 44, 260, 84], "spans": [{"type": "text", "raw_type": "text", "text": "Actual concluding paragraph.", "bbox": [20, 44, 260, 84]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "heading",
                            "bbox": [20, 120, 180, 140],
                            "text": "Competing interests",
                            "lines": [{"bbox": [20, 120, 180, 140], "spans": [{"type": "text", "raw_type": "text", "text": "Competing interests", "bbox": [20, 120, 180, 140]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "heading", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [20, 144, 260, 184],
                            "text": "The authors declare that they have no competing interests.",
                            "lines": [{"bbox": [20, 144, 260, 184], "spans": [{"type": "text", "raw_type": "text", "text": "The authors declare that they have no competing interests.", "bbox": [20, 144, 260, 184]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "heading",
                            "bbox": [20, 200, 120, 220],
                            "text": "References",
                            "lines": [{"bbox": [20, 200, 120, 220], "spans": [{"type": "text", "raw_type": "text", "text": "References", "bbox": [20, 200, 120, 220]}]}],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "heading", "by": "", "confidence": 0.0},
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-ancillary-tail-doc",
        source_json_path=Path("/tmp/generic-ancillary-tail.json"),
    )

    items = extract_text_items(adapted, 0)

    assert [item.text for item in items] == [
        "Conclusions",
        "Actual concluding paragraph.",
        "Competing interests",
        "The authors declare that they have no competing interests.",
        "References",
    ]
