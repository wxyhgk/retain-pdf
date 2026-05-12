from __future__ import annotations

from pathlib import Path
import sys


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
for path in (REPO_ROOT, SCRIPTS_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from backend.scripts.devtools.word_export.cli import main


if __name__ == "__main__":
    main()
