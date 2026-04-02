"""OCR-only provider entrypoint.

This worker stops after provider download/unpack + document_schema normalization.
It intentionally does not start translation or rendering.
"""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from services.mineru.ocr_pipeline import main


if __name__ == "__main__":
    main()
