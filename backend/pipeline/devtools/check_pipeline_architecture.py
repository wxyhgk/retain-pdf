#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys

SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))

from devtools.architecture_checks.pipeline import main


if __name__ == "__main__":
    raise SystemExit(main())
