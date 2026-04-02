"""Translate/render starting from normalized OCR input only."""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from services.translation.from_ocr_pipeline import main


if __name__ == "__main__":
    main()
