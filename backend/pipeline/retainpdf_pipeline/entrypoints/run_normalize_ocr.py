"""Normalize an already materialized OCR provider payload into document.v1 artifacts."""

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure
from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="normalization", provider="ocr")
