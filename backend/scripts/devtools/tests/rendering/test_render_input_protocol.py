import sys
import tempfile
from pathlib import Path
from unittest import mock

import fitz

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from runtime.pipeline.render_inputs import resolve_render_inputs
from runtime.pipeline.render_stage import run_render_stage
from runtime.pipeline.translation_loader import load_translated_pages
from services.translation.payload.manifest import write_translation_manifest


def _write_payload(path: Path, translated_text: str) -> None:
    path.write_text(f'[{{"translated_text": "{translated_text}"}}]', encoding="utf-8")


def test_resolve_render_inputs_accepts_explicit_manifest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf_path = root / "source.pdf"
        source_pdf_path.write_bytes(b"%PDF-1.4\n")
        translations_dir = root / "translations"
        translations_dir.mkdir()
        payload_path = translations_dir / "custom-page-001.json"
        _write_payload(payload_path, "manifest text")
        manifest_path = write_translation_manifest(translations_dir, {0: payload_path})

        resolved = resolve_render_inputs(
            source_pdf_path=source_pdf_path,
            translation_manifest_path=manifest_path,
        )

        assert resolved.source_pdf_path == source_pdf_path
        assert resolved.translations_dir == translations_dir
        assert resolved.translation_manifest_path == manifest_path


def test_resolve_render_inputs_requires_translation_artifacts() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf_path = root / "source.pdf"
        source_pdf_path.write_bytes(b"%PDF-1.4\n")
        translations_dir = root / "translations"
        translations_dir.mkdir()

        try:
            resolve_render_inputs(
                source_pdf_path=source_pdf_path,
                translations_dir=translations_dir,
            )
        except RuntimeError as exc:
            assert "Render-only input error" in str(exc)
            assert "translation-manifest.json" in str(exc)
        else:
            raise AssertionError("expected render input protocol error")


def test_resolve_render_inputs_accepts_legacy_page_payloads_without_manifest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf_path = root / "source.pdf"
        source_pdf_path.write_bytes(b"%PDF-1.4\n")
        translations_dir = root / "translations"
        translations_dir.mkdir()
        _write_payload(translations_dir / "page-001-deepseek.json", "legacy text")

        resolved = resolve_render_inputs(
            source_pdf_path=source_pdf_path,
            translations_dir=translations_dir,
        )

        assert resolved.source_pdf_path == source_pdf_path
        assert resolved.translations_dir == translations_dir
        assert resolved.translation_manifest_path is None


def test_load_translated_pages_accepts_explicit_manifest_path() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        translations_dir = root / "translations"
        translations_dir.mkdir()
        payload_path = translations_dir / "custom-page-002.json"
        _write_payload(payload_path, "manifest text")
        manifest_path = write_translation_manifest(translations_dir, {1: payload_path})

        pages = load_translated_pages(
            translations_dir,
            manifest_path=manifest_path,
        )

        assert sorted(pages) == [1]
        assert pages[1][0]["translated_text"] == "manifest text"


def test_run_render_stage_uses_manifest_backed_pdf_inputs() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf_path = root / "source.pdf"
        translations_dir = root / "translations"
        output_pdf_path = root / "output.pdf"
        translations_dir.mkdir()

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf_path)
        doc.close()

        payload_path = translations_dir / "custom-page-001.json"
        _write_payload(payload_path, "manifest text")
        manifest_path = write_translation_manifest(translations_dir, {0: payload_path})

        with mock.patch(
            "runtime.pipeline.render_stage.resolve_effective_render_mode",
            return_value="overlay",
        ) as resolve_mode_mock, mock.patch(
            "runtime.pipeline.render_stage.build_book_from_translations",
            return_value=1,
        ) as build_mock:
            result = run_render_stage(
                source_pdf_path=source_pdf_path,
                translations_dir=translations_dir,
                translation_manifest_path=manifest_path,
                output_pdf_path=output_pdf_path,
                start_page=0,
                end_page=0,
                render_mode="auto",
            )

        assert result["output_pdf_path"] == output_pdf_path
        assert result["pages_rendered"] == 1
        assert result["effective_render_mode"] == "overlay"
        resolve_mode_mock.assert_called_once()
        build_mock.assert_called_once()
        assert build_mock.call_args.kwargs["source_pdf_path"] == source_pdf_path
        assert build_mock.call_args.kwargs["translations_dir"] == translations_dir
        assert build_mock.call_args.kwargs["translation_manifest_path"] == manifest_path
        assert build_mock.call_args.kwargs["render_mode"] == "overlay"
