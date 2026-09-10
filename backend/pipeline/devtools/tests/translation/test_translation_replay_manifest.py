from __future__ import annotations

import json
from pathlib import Path


GOLDEN_REPLAY_DIR = Path(__file__).resolve().parent / "golden_replay"


def test_translation_replay_manifest_has_required_categories() -> None:
    manifest = json.loads((GOLDEN_REPLAY_DIR / "manifest.json").read_text(encoding="utf-8"))
    categories = {case["category"] for case in manifest["cases"]}

    assert manifest["schema"] == "translation_replay_golden_manifest_v1"
    assert {
        "protocol_shell",
        "empty_output",
        "english_residue",
        "technical_block",
    }.issubset(categories)


def test_translation_replay_manifest_does_not_embed_secrets() -> None:
    text = (GOLDEN_REPLAY_DIR / "manifest.json").read_text(encoding="utf-8")

    assert "sk-" not in text
    assert "api_key" not in text.lower()
    assert "token" not in text.lower()
