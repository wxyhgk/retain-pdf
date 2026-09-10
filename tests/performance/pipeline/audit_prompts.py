"""Compatibility entrypoint; implementation lives in tools.analysis.audit_prompts."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tools.analysis.audit_prompts import *  # noqa: F401,F403
from tools.analysis.audit_prompts import main

if __name__ == "__main__":
    raise SystemExit(main())
