from services.document_schema.compat import default_block_continuation_hint
from services.document_schema.compat import upgrade_document_payload
from services.document_schema.provider_adapters.paddle.continuation import assign_paddle_continuation_hints
from services.document_schema.validator import validate_document_payload


def _minimal_document(*, schema_version: str = "1.0") -> dict:
    return {
        "schema": "normalized_document_v1",
        "schema_version": schema_version,
        "document_id": "doc",
        "source": {"provider": "test"},
        "page_count": 1,
        "pages": [
            {
                "page_index": 0,
                "width": 200.0,
                "height": 200.0,
                "unit": "pt",
                "blocks": [
                    {
                        "block_id": "p001-b0001",
                        "page_index": 0,
                        "order": 0,
                        "type": "text",
                        "sub_type": "body",
                        "bbox": [0, 0, 100, 20],
                        "text": "hello",
                        "lines": [],
                        "segments": [],
                        "tags": [],
                        "derived": {"role": "", "by": "", "confidence": 0.0},
                        "metadata": {},
                        "source": {"provider": "test"},
                    }
                ],
            }
        ],
        "derived": {},
        "markers": {},
    }


def test_legacy_upgrade_adds_default_continuation_hint_and_validates() -> None:
    upgraded = upgrade_document_payload(_minimal_document(schema_version="1.0"))
    block = upgraded["pages"][0]["blocks"][0]
    assert block["continuation_hint"] == default_block_continuation_hint()
    validate_document_payload(upgraded)


def test_paddle_continuation_hints_cover_intra_page_and_cross_page_groups() -> None:
    pages = [
        {
            "page_index": 0,
            "blocks": [
                {
                    "block_id": "p001-b0001",
                    "page_index": 0,
                    "order": 0,
                    "metadata": {
                        "raw_group_id": "12",
                        "raw_global_group_id": "",
                        "raw_block_order": 0,
                    },
                },
                {
                    "block_id": "p001-b0002",
                    "page_index": 0,
                    "order": 1,
                    "metadata": {
                        "raw_group_id": "12",
                        "raw_global_group_id": "",
                        "raw_block_order": 1,
                    },
                },
                {
                    "block_id": "p001-b0003",
                    "page_index": 0,
                    "order": 2,
                    "metadata": {
                        "raw_group_id": "",
                        "raw_global_group_id": "global-A",
                        "raw_block_order": 0,
                    },
                },
            ],
        },
        {
            "page_index": 1,
            "blocks": [
                {
                    "block_id": "p002-b0001",
                    "page_index": 1,
                    "order": 0,
                    "metadata": {
                        "raw_group_id": "",
                        "raw_global_group_id": "global-A",
                        "raw_block_order": 1,
                    },
                }
            ],
        },
    ]

    assign_paddle_continuation_hints(pages)

    first, second, cross_head = pages[0]["blocks"]
    cross_tail = pages[1]["blocks"][0]

    assert first["continuation_hint"]["source"] == "provider"
    assert first["continuation_hint"]["scope"] == "intra_page"
    assert first["continuation_hint"]["role"] == "head"
    assert second["continuation_hint"]["role"] == "tail"
    assert first["continuation_hint"]["group_id"] == second["continuation_hint"]["group_id"]

    assert cross_head["continuation_hint"]["source"] == "provider"
    assert cross_head["continuation_hint"]["scope"] == "cross_page"
    assert cross_head["continuation_hint"]["role"] == "head"
    assert cross_tail["continuation_hint"]["scope"] == "cross_page"
    assert cross_tail["continuation_hint"]["role"] == "tail"
    assert cross_head["continuation_hint"]["group_id"] == cross_tail["continuation_hint"]["group_id"]


def test_paddle_continuation_hints_ignore_multi_block_groups_without_order() -> None:
    pages = [
        {
            "page_index": 0,
            "blocks": [
                {
                    "block_id": "p001-b0001",
                    "page_index": 0,
                    "order": 0,
                    "metadata": {
                        "raw_group_id": "x",
                        "raw_global_group_id": "",
                        "raw_block_order": None,
                    },
                },
                {
                    "block_id": "p001-b0002",
                    "page_index": 0,
                    "order": 1,
                    "metadata": {
                        "raw_group_id": "x",
                        "raw_global_group_id": "",
                        "raw_block_order": 1,
                    },
                },
            ],
        }
    ]

    assign_paddle_continuation_hints(pages)

    assert pages[0]["blocks"][0]["continuation_hint"] == default_block_continuation_hint()
    assert pages[0]["blocks"][1]["continuation_hint"] == default_block_continuation_hint()
