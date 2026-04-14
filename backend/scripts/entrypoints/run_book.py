"""Book worker entrypoint.

Thin wrapper over the spec-driven from_ocr pipeline.
"""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from foundation.shared.structured_errors import run_with_structured_failure
from services.translation.from_ocr_pipeline import main


if __name__ == "__main__":
    run_with_structured_failure(main, default_stage="translation", provider="translation")
