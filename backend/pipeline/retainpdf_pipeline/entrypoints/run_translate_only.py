"""Translate starting from normalized OCR input only."""

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure
from retainpdf_pipeline.translate.entrypoints.translate_only_pipeline import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="translation", provider="translation")
