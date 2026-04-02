from __future__ import annotations

from pathlib import Path

from services.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from services.document_schema.providers import PROVIDER_MINERU
from services.document_schema.providers import PROVIDER_MINERU_CONTENT_LIST_V2
from services.document_schema.providers import PROVIDER_PADDLE
from services.mineru.contracts import MINERU_CONTENT_LIST_V2_FILE_NAME
from services.mineru.contracts import MINERU_LAYOUT_JSON_FILE_NAME


# Single source of truth for provider fixtures consumed by regression_check.py.
PROVIDER_FIXTURES = [
    {
        "name": "raw_layout",
        "provider": PROVIDER_MINERU,
        "document_id": "regression-raw-layout",
        "path": Path("output/20260330093544-795f1c/ocr/unpacked") / MINERU_LAYOUT_JSON_FILE_NAME,
    },
    {
        "name": "content_list_v2",
        "provider": PROVIDER_MINERU_CONTENT_LIST_V2,
        "document_id": "regression-content-v2",
        "path": Path("output/20260330093544-795f1c/ocr/unpacked") / MINERU_CONTENT_LIST_V2_FILE_NAME,
    },
    {
        "name": "generic_fixture",
        "provider": PROVIDER_GENERIC_FLAT_OCR,
        "document_id": "regression-generic",
        "path": Path("scripts/devtools/tests/document_schema/fixtures/generic_flat_ocr.minimal.json"),
    },
    {
        "name": "paddle_fixture",
        "provider": PROVIDER_PADDLE,
        "document_id": "regression-paddle",
        "path": Path("rust_api/src/ocr_provider/paddle/json_full.json"),
    },
    {
        "name": "paddle_sci_fixture",
        "provider": PROVIDER_PADDLE,
        "document_id": "regression-paddle-sci",
        "path": Path("rust_api/src/ocr_provider/paddle/json_sci.json"),
    },
]


def expected_fixture_providers() -> set[str]:
    return {str(item["provider"]) for item in PROVIDER_FIXTURES}


def fixture_names() -> list[str]:
    return [str(item["name"]) for item in PROVIDER_FIXTURES]
