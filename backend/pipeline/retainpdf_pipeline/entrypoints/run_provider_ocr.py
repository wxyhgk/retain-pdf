"""Top-level OCR-only provider entry for local use.

This is the generic local entrypoint name for the OCR-only provider flow.
It stops after provider download/unpack plus document_schema normalization.
"""

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure
from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="provider", provider="ocr")
