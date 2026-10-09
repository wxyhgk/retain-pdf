from __future__ import annotations

from pathlib import Path
from unittest import mock

import pytest


from retainpdf_pipeline.render.workflow.executor import _dispatch_render_mode
from retainpdf_pipeline.render.workflow.modes import RENDER_MODE_HANDLERS
from devtools.tests.pdf_fixtures import write_pdf


def test_render_mode_registry_covers_all_dispatch_modes() -> None:
    assert sorted(RENDER_MODE_HANDLERS) == ["dual", "overlay", "typst", "typst_visual"]


def test_dispatch_render_mode_rejects_unknown_mode() -> None:
    context = mock.Mock()
    context.render_engine = "typst"  # 测的是按模式分派，与排版引擎无关

    with pytest.raises(ValueError, match="unknown render mode"):
        _dispatch_render_mode(
            mode="typsts",
            source_pdf_path=Path("/tmp/source.pdf"),
            translated_pages={},
            context=context,
            extract_selected_pages=False,
        )


def test_dispatch_render_mode_routes_each_mode_through_registry() -> None:
    context = mock.Mock()
    context.render_engine = "typst"  # 测的是按模式分派，与排版引擎无关
    calls: list[str] = []

    def _fake(mode: str):
        def _handler(*, source_pdf_path, translated_pages, context):
            calls.append(mode)
            return 1, {"mode": mode}

        return _handler

    registry = {mode: _fake(mode) for mode in RENDER_MODE_HANDLERS}
    with mock.patch.dict(
        "retainpdf_pipeline.render.workflow.modes.RENDER_MODE_HANDLERS",
        registry,
        clear=True,
    ):
        for mode in sorted(registry):
            pages, diagnostics = _dispatch_render_mode(
                mode=mode,
                source_pdf_path=Path("/tmp/source.pdf"),
                translated_pages={},
                context=context,
                extract_selected_pages=False,
            )
            assert pages == 1
            assert diagnostics == {"mode": mode}

    assert sorted(calls) == ["dual", "overlay", "typst", "typst_visual"]


@pytest.mark.needs_typst
def test_dispatch_overlay_runs_end_to_end_on_single_page(tmp_path: Path) -> None:
    import fitz

    from retainpdf_pipeline.render.workflow.context import RenderExecutionContext

    source_pdf = tmp_path / "source.pdf"
    write_pdf(source_pdf, width=200, height=300, text="source text", at=(20, 40), fontsize=12)

    context = RenderExecutionContext(
        output_pdf_path=tmp_path / "out.pdf",
        start_page=0,
        end_page=0,
    )
    pages, diagnostics = _dispatch_render_mode(
        mode="overlay",
        source_pdf_path=source_pdf,
        translated_pages={
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 60.0],
                    "source_text": "source text",
                    "protected_source_text": "source text",
                    "protected_translated_text": "译文",
                }
            ]
        },
        context=context,
        extract_selected_pages=False,
    )

    assert pages == 1
    assert (tmp_path / "out.pdf").exists()

    rendered = fitz.open(tmp_path / "out.pdf")
    try:
        assert "译文" in rendered[0].get_text()
    finally:
        rendered.close()
