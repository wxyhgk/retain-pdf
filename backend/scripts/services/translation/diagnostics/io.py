from __future__ import annotations

from pathlib import Path

from services.mineru.artifacts import save_json

from .aggregator import TranslationRunDiagnostics


def write_translation_diagnostics(path: Path, run: TranslationRunDiagnostics) -> dict:
    summary = run.build_summary()
    save_json(path, summary)
    return summary
