from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema import adapters


def test_detect_ocr_provider_continues_after_detector_exception(monkeypatch) -> None:
    def _broken_detector(_: dict) -> bool:
        raise ValueError("detector exploded")

    monkeypatch.setattr(
        adapters,
        "_ADAPTER_DETECTORS",
        [
            ("broken", _broken_detector),
            ("working", lambda _: True),
        ],
    )

    report = adapters.detect_ocr_provider_with_report({})

    assert report["matched"] is True
    assert report["provider"] == "working"
    assert report["attempts"][0]["provider"] == "broken"
    assert report["attempts"][0]["matched"] is False
    assert "ValueError: detector exploded" in report["attempts"][0]["error"]
    assert report["attempts"][1] == {"provider": "working", "matched": True}


def test_explicit_provider_mismatch_fails_fast(tmp_path: Path) -> None:
    source_json_path = tmp_path / "generic.json"
    source_json_path.write_text(
        json.dumps(
            {
                "provider": "generic_flat_ocr",
                "pages": [
                    {
                        "width": 600,
                        "height": 800,
                        "blocks": [
                            {
                                "type": "text",
                                "bbox": [10, 10, 100, 30],
                                "text": "generic sample",
                            }
                        ],
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="provider=paddle detected=generic_flat_ocr"):
        adapters.adapt_path_to_document_v1_with_report(
            source_json_path=source_json_path,
            document_id="mismatch-doc",
            provider="paddle",
        )
