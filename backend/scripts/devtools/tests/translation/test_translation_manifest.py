import json
import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from runtime.pipeline.translation_loader import load_translated_pages
from services.translation.payload.manifest import load_translation_manifest
from services.translation.payload.manifest import load_translation_manifest_file
from services.translation.payload.manifest import write_translation_manifest


def _write_payload(path: Path, translated_text: str) -> None:
    path.write_text(
        json.dumps([{"translated_text": translated_text}], ensure_ascii=False),
        encoding="utf-8",
    )


def test_translation_manifest_round_trip() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        payload_path = translations_dir / "custom-page-001.json"
        _write_payload(payload_path, "manifest text")

        manifest_path = write_translation_manifest(translations_dir, {0: payload_path})
        loaded = load_translation_manifest(translations_dir)
        manifest_payload = json.loads(manifest_path.read_text(encoding="utf-8"))

        assert loaded == {0: payload_path}
        assert manifest_payload["pages"][0]["path"] == "custom-page-001.json"


def test_load_translated_pages_prefers_manifest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        legacy_path = translations_dir / "page-001-deepseek.json"
        manifest_path = translations_dir / "custom-page-003.json"
        _write_payload(legacy_path, "legacy text")
        _write_payload(manifest_path, "manifest text")
        write_translation_manifest(translations_dir, {2: manifest_path})

        pages = load_translated_pages(translations_dir)

        assert sorted(pages) == [2]
        assert pages[2][0]["translated_text"] == "manifest text"


def test_load_translated_pages_falls_back_to_legacy_names() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        legacy_path = translations_dir / "page-002-deepseek.json"
        _write_payload(legacy_path, "legacy text")

        pages = load_translated_pages(translations_dir)

        assert sorted(pages) == [1]
        assert pages[1][0]["translated_text"] == "legacy text"


def test_load_translation_manifest_file_supports_explicit_path() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        payload_path = translations_dir / "custom-page-005.json"
        _write_payload(payload_path, "manifest text")
        manifest_path = write_translation_manifest(translations_dir, {4: payload_path})

        loaded = load_translation_manifest_file(manifest_path)

        assert loaded == {4: payload_path}


def test_translation_manifest_can_store_glossary_summary_without_affecting_loader() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        payload_path = translations_dir / "custom-page-001.json"
        _write_payload(payload_path, "manifest text")

        manifest_path = write_translation_manifest(
            translations_dir,
            {0: payload_path},
            glossary={
                "enabled": True,
                "glossary_id": "glossary-123",
                "entry_count": 2,
                "target_hit_entry_count": 1,
            },
            summary={
                "translation_protocol_version": "v2",
                "status_summary": {"translated": 1},
            },
        )
        manifest_payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        loaded = load_translation_manifest(translations_dir)

        assert loaded == {0: payload_path}
        assert manifest_payload["glossary"]["glossary_id"] == "glossary-123"
        assert manifest_payload["glossary"]["target_hit_entry_count"] == 1
        assert manifest_payload["translation_protocol_version"] == "v2"
        assert manifest_payload["status_summary"]["translated"] == 1
