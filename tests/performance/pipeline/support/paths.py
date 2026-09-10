"""Resolve checkout paths without relying on cwd or a Git installation."""
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[2]
BACKEND = ROOT / "backend"
PIPELINE = BACKEND / "pipeline"
