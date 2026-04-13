import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.document_schema.adapters import adapt_payload_to_document_v1
from services.document_schema.providers import PROVIDER_MINERU
from services.translation.policy.reference_section import resolve_reference_cutoff


def _text_block(block_type: str, text: str) -> dict:
    return {
        "type": block_type,
        "bbox": [0, 0, 100, 20],
        "lines": [
            {
                "bbox": [0, 0, 100, 20],
                "spans": [
                    {
                        "type": "text",
                        "content": text,
                        "bbox": [0, 0, 100, 20],
                    }
                ],
            }
        ],
    }


def test_mineru_adapter_leaves_reference_tags_empty_but_cutoff_falls_back_to_heading_scan() -> None:
    payload = {
        "pdf_info": [
            {
                "page_size": [595.0, 842.0],
                "para_blocks": [
                    _text_block("title", "References"),
                    _text_block(
                        "text",
                        (
                            "For infilling tasks, we attempt to query the LLaMA model with the prompt given the "
                            "<prefix> and <suffix>, please answer the <middle> part, which includes both prefix and "
                            "suffix information. However, this approach is no better than simply completing the prefix, "
                            "likely because the LLaMA model needs tuning for filling in the middle (FIM; Bavarian et al. "
                            "2022b). Additionally, Bavarian et al. (2022b) notes that using AR models for infilling "
                            "presents challenges, such as prompting difficulties and repetition."
                        ),
                    ),
                ],
            }
        ]
    }

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_MINERU,
        document_id="mineru-reference-regression",
        source_json_path=Path("layout.json"),
    )

    title_block, body_block = document["pages"][0]["blocks"]

    assert (document.get("markers") or {}).get("reference_start") is None
    assert resolve_reference_cutoff(document) == (0, 0)
    assert title_block["derived"]["role"] == ""
    assert body_block["derived"]["role"] == ""
    assert "reference_heading" not in title_block["tags"]
    assert "reference_entry" not in body_block["tags"]
    assert "reference_zone" not in body_block["tags"]
