from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render import render_mode


class _FakeDoc:
    def __len__(self) -> int:
        return 1

    def __getitem__(self, _index: int) -> object:
        return object()

    def close(self) -> None:
        return None


def test_auto_render_mode_uses_typst_visual_for_non_editable_pdf(monkeypatch, tmp_path) -> None:
    source_pdf = tmp_path / "scan.pdf"
    source_pdf.write_bytes(b"%PDF-1.7\n")

    monkeypatch.setattr(render_mode.fitz, "open", lambda _path: _FakeDoc())
    monkeypatch.setattr(render_mode, "is_pseudo_editable_scan_pdf", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(render_mode, "is_editable_pdf", lambda *_args, **_kwargs: False)

    mode = render_mode.resolve_effective_render_mode(
        render_mode="auto",
        source_pdf_path=source_pdf,
        start_page=0,
        end_page=-1,
        translated_pages_map={0: [{"source_text": "hello world", "bbox": [0, 0, 10, 10]}]},
    )

    assert mode == "typst_visual"


def test_auto_render_mode_uses_typst_visual_for_pseudo_editable_scan_pdf(monkeypatch, tmp_path) -> None:
    source_pdf = tmp_path / "pseudo-scan.pdf"
    source_pdf.write_bytes(b"%PDF-1.7\n")

    monkeypatch.setattr(render_mode.fitz, "open", lambda _path: _FakeDoc())
    monkeypatch.setattr(render_mode, "is_pseudo_editable_scan_pdf", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(render_mode, "is_editable_pdf", lambda *_args, **_kwargs: True)

    mode = render_mode.resolve_effective_render_mode(
        render_mode="auto",
        source_pdf_path=source_pdf,
        start_page=0,
        end_page=-1,
        translated_pages_map={0: [{"source_text": "hello world", "bbox": [0, 0, 10, 10]}]},
    )

    assert mode == "typst_visual"


def test_auto_render_mode_uses_overlay_for_editable_pdf(monkeypatch, tmp_path) -> None:
    source_pdf = tmp_path / "editable.pdf"
    source_pdf.write_bytes(b"%PDF-1.7\n")

    monkeypatch.setattr(render_mode.fitz, "open", lambda _path: _FakeDoc())
    monkeypatch.setattr(render_mode, "is_pseudo_editable_scan_pdf", lambda *_args, **_kwargs: False)
    monkeypatch.setattr(render_mode, "is_editable_pdf", lambda *_args, **_kwargs: True)

    mode = render_mode.resolve_effective_render_mode(
        render_mode="auto",
        source_pdf_path=source_pdf,
        start_page=0,
        end_page=-1,
        translated_pages_map={0: [{"source_text": "hello world", "bbox": [0, 0, 10, 10]}]},
    )

    assert mode == "overlay"


def test_explicit_overlay_render_mode_is_still_supported(tmp_path) -> None:
    source_pdf = tmp_path / "explicit.pdf"
    source_pdf.write_bytes(b"%PDF-1.7\n")

    mode = render_mode.resolve_effective_render_mode(
        render_mode="overlay",
        source_pdf_path=source_pdf,
        start_page=0,
        end_page=-1,
        translated_pages_map={0: [{"source_text": "hello world", "bbox": [0, 0, 10, 10]}]},
    )

    assert mode == "overlay"
