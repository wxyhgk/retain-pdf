"""Top-level one-command OCR-provider entry for the current MinerU implementation.

This thin wrapper keeps the recommended CLI under `scripts/entrypoints/`
while reusing the stable implementation in `services/mineru/mineru_pipeline.py`.
"""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from services.mineru.mineru_pipeline import main


if __name__ == "__main__":
    main()
