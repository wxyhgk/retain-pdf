from __future__ import annotations

from pathlib import Path

from services.document_schema import DOCUMENT_SCHEMA_NAME
from services.document_schema import DOCUMENT_SCHEMA_VERSION


def build_document_record(
    *,
    document_id: str,
    provider: str,
    provider_version: str,
    source_json_path: Path,
    pages: list[dict],
    notes: str,
    raw_file_key: str = "source_json",
) -> dict:
    return {
        "schema": DOCUMENT_SCHEMA_NAME,
        "schema_version": DOCUMENT_SCHEMA_VERSION,
        "document_id": document_id,
        "source": {
            "provider": provider,
            "provider_version": provider_version,
            "raw_files": {
                raw_file_key: str(source_json_path),
            },
        },
        "page_count": len(pages),
        "pages": pages,
        "derived": {
            "notes": notes,
        },
        "markers": {},
    }
