"""Compatibility entrypoint; implementation lives in tools.analysis.compare_optimization."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tools.analysis.compare_optimization import *  # noqa: F401,F403
from tools.analysis.compare_optimization import main

if __name__ == "__main__":
    raise SystemExit(main())
