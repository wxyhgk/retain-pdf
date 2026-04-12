import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from runtime.pipeline.render_inputs import resolve_render_inputs
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


def test_resolve_render_inputs_accepts_legacy_translation_dir() -> None:
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
