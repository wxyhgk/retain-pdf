"""Top-level one-command OCR-provider entry for local use.

This is the generic local entrypoint name for the current provider-backed
full workflow. The provider implementation is intentionally hidden behind
this neutral name so callers depend on the workflow contract, not the
current provider choice.
"""

from retainpdf_pipeline.foundation.shared.structured_errors import run_with_structured_failure
from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="provider", provider="ocr")
