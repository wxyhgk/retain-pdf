import json
import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.translation_loader import load_translated_pages
import retainpdf_pipeline.translate.core.payload.manifest as manifest_module
from retainpdf_pipeline.translate.core.payload.manifest import load_translation_manifest
from retainpdf_pipeline.translate.core.payload.manifest import load_translation_manifest_file
from retainpdf_pipeline.translate.core.payload.manifest import write_translation_manifest


def _write_payload(path: Path, translated_text: str) -> None:
    path.write_text(
        json.dumps(
            [
                {
                    "item_id": "p001-b001",
                    "block_kind": "text",
                    "layout_role": "paragraph",
                    "semantic_role": "body",
                    "structure_role": "body",
                    "policy_translate": True,
                    "asset_id": "",
                    "reading_order": 0,
                    "raw_block_type": "paragraph",
                    "normalized_sub_type": "body",
                    "translated_text": translated_text,
                }
            ],
            ensure_ascii=False,
        ),
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
        assert manifest_payload["status"] == "complete"
        assert manifest_payload["pages"][0]["path"] == "custom-page-001.json"


def test_write_translation_manifest_uses_same_directory_atomic_replace(tmp_path, monkeypatch) -> None:
    translations_dir = tmp_path / "translations"
    payload_path = translations_dir / "custom-page-001.json"
    payload_path.parent.mkdir(parents=True)
    _write_payload(payload_path, "manifest text")
    real_replace = manifest_module.os.replace
    replace_calls: list[tuple[Path, Path]] = []

    def capture_replace(src, dst):
        replace_calls.append((Path(src), Path(dst)))
        real_replace(src, dst)

    monkeypatch.setattr(manifest_module.os, "replace", capture_replace)

    manifest_path = write_translation_manifest(translations_dir, {0: payload_path})

    assert replace_calls
    tmp_path_used, target_path = replace_calls[-1]
    assert tmp_path_used.parent == manifest_path.parent
    assert target_path == manifest_path
    assert not tmp_path_used.exists()


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


def test_load_translated_pages_requires_manifest_even_if_legacy_page_payload_exists() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        legacy_path = translations_dir / "page-002-deepseek.json"
        _write_payload(legacy_path, "legacy text")

        try:
            load_translated_pages(translations_dir)
        except RuntimeError as exc:
            assert "Translation manifest not found" in str(exc)
        else:
            raise AssertionError("expected translation manifest error")


def test_load_translated_pages_requires_manifest() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)

        try:
            load_translated_pages(translations_dir)
        except RuntimeError as exc:
            assert "Translation manifest not found" in str(exc)
        else:
            raise AssertionError("expected translation manifest error")


def test_load_translation_manifest_file_supports_explicit_path() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        payload_path = translations_dir / "custom-page-005.json"
        _write_payload(payload_path, "manifest text")
        manifest_path = write_translation_manifest(translations_dir, {4: payload_path})

        loaded = load_translation_manifest_file(manifest_path)

        assert loaded == {4: payload_path}


def test_write_translation_manifest_rejects_payload_outside_translations_dir(tmp_path) -> None:
    translations_dir = tmp_path / "translations"
    outside_payload = tmp_path / "outside-page.json"
    translations_dir.mkdir()
    _write_payload(outside_payload, "outside text")

    try:
        write_translation_manifest(translations_dir, {0: outside_payload})
    except RuntimeError as exc:
        assert "under translations_dir" in str(exc)
    else:
        raise AssertionError("expected outside payload path error")


def test_load_translation_manifest_rejects_absolute_payload_path(tmp_path) -> None:
    translations_dir = tmp_path / "translations"
    translations_dir.mkdir()
    payload_path = translations_dir / "page-001.json"
    _write_payload(payload_path, "manifest text")
    manifest_path = translations_dir / "translation-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema": "translation_manifest_v1",
                "schema_version": 1,
                "pages": [{"page_index": 0, "path": str(payload_path)}],
            }
        ),
        encoding="utf-8",
    )

    try:
        load_translation_manifest(translations_dir)
    except RuntimeError as exc:
        assert "absolute payload path" in str(exc)
    else:
        raise AssertionError("expected absolute payload path error")


def test_load_translation_manifest_rejects_payload_path_escape(tmp_path) -> None:
    translations_dir = tmp_path / "translations"
    outside_payload = tmp_path / "outside-page.json"
    translations_dir.mkdir()
    _write_payload(outside_payload, "outside text")
    manifest_path = translations_dir / "translation-manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema": "translation_manifest_v1",
                "schema_version": 1,
                "pages": [{"page_index": 0, "path": "../outside-page.json"}],
            }
        ),
        encoding="utf-8",
    )

    try:
        load_translation_manifest(translations_dir)
    except RuntimeError as exc:
        assert "escapes translations_dir" in str(exc)
    else:
        raise AssertionError("expected path escape error")


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


def test_translation_manifest_can_store_invocation_metadata_without_affecting_loader() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        translations_dir = Path(tmp)
        payload_path = translations_dir / "custom-page-001.json"
        _write_payload(payload_path, "manifest text")

        manifest_path = write_translation_manifest(
            translations_dir,
            {0: payload_path},
            summary={
                "invocation": {
                    "stage": "translate",
                    "input_protocol": "stage_spec",
                    "stage_spec_schema_version": "translate.stage.v1",
                }
            },
        )
        manifest_payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        loaded = load_translation_manifest(translations_dir)

        assert loaded == {0: payload_path}
        assert manifest_payload["invocation"]["stage"] == "translate"
        assert manifest_payload["invocation"]["input_protocol"] == "stage_spec"
