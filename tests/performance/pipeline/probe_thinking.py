"""Compatibility entrypoint; implementation lives in tools.experiments.probe_thinking."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tools.experiments.probe_thinking import *  # noqa: F401,F403
from tools.experiments.probe_thinking import main

if __name__ == "__main__":
    raise SystemExit(main())
