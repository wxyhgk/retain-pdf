from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.runtime.pipeline import book_pipeline


def test_run_book_pipeline_returns_render_diagnostics(monkeypatch, tmp_path: Path) -> None:
    source_json = tmp_path / "document.v1.json"
    source_pdf = tmp_path / "source.pdf"
    output_dir = tmp_path / "translated"
    output_pdf = tmp_path / "rendered" / "out.pdf"
    source_json.write_text("{}", encoding="utf-8")
    source_pdf.write_bytes(b"%PDF-1.4\n")

    translated_pages_map = {
        0: [
            {
                "item_id": "p001-b001",
                "final_status": "translated",
                "protected_translated_text": "translated",
            }
        ]
    }

    monkeypatch.setattr(
        book_pipeline,
        "translate_book_pipeline",
        lambda **_kwargs: {
            "page_count": 1,
            "translated_items": 1,
            "summaries": [{"page_idx": 0, "translated_items": 1, "total_items": 1}],
            "translated_pages_map": translated_pages_map,
            "start_page": 0,
            "end_page": 0,
            "translation_review": {},
        },
    )
    monkeypatch.setattr(book_pipeline, "write_translation_diagnostics", lambda *_args, **_kwargs: {})
    monkeypatch.setattr(book_pipeline, "write_translation_debug_index", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(book_pipeline, "blocking_untranslated_items", lambda _pages: [])
    monkeypatch.setattr(book_pipeline, "enforce_no_blocking_review_errors", lambda _review: None)

    class _FakePrewarmHandle:
        def wait(self):
            return tmp_path / "manifest.json"

    monkeypatch.setattr(book_pipeline, "start_render_source_prewarm", lambda _spec: _FakePrewarmHandle())
    monkeypatch.setattr(
        book_pipeline,
        "run_render_stage",
        lambda **_kwargs: {
            "output_pdf_path": output_pdf,
            "effective_render_mode": "typst",
            "render_diagnostics": {
                "typst_cover_fallback_pages": {"count": 1, "head": [0], "tail": []},
            },
        },
    )

    summary = book_pipeline.run_book_pipeline(
        source_json_path=source_json,
        source_pdf_path=source_pdf,
        output_dir=output_dir,
        output_pdf_path=output_pdf,
        api_key="",
        start_page=0,
        end_page=0,
        batch_size=1,
        workers=1,
        model="model",
        base_url="",
        mode="fast",
        skip_title_translation=False,
        render_mode="typst",
    )

    assert summary["render_diagnostics"]["typst_cover_fallback_pages"]["count"] == 1
