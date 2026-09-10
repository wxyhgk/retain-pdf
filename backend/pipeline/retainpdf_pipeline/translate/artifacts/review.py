from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.services.pipeline_shared.io import save_json


TRANSLATION_REVIEW_FILE_NAME = "translation_review.json"
TRANSLATION_REVIEW_SCHEMA = "translation_review_v1"
TRANSLATION_REVIEW_SCHEMA_VERSION = 1


def write_translation_review(path: Path, payload: dict[str, object]) -> dict[str, object]:
    save_json(path, payload)
    return payload


__all__ = [
    "TRANSLATION_REVIEW_FILE_NAME",
    "TRANSLATION_REVIEW_SCHEMA",
    "TRANSLATION_REVIEW_SCHEMA_VERSION",
    "write_translation_review",
]
