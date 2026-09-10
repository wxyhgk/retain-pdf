from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.architecture_checks import document_semantics


def test_rejects_legacy_semantics_facade_in_production_consumer(
    tmp_path: Path,
    monkeypatch,
) -> None:
    translation_root = tmp_path / "translation"
    rendering_root = tmp_path / "rendering"
    translation_root.mkdir()
    rendering_root.mkdir()
    (translation_root / "consumer.py").write_text(
        "from retainpdf_pipeline.ocr.document_schema.semantics import is_bodylike_block\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(document_semantics, "TRANSLATION_ROOT", translation_root)
    monkeypatch.setattr(document_semantics, "RENDERING_ROOT", rendering_root)
    monkeypatch.setattr(document_semantics, "PACKAGE_ROOT", tmp_path / "empty-package")

    errors: list[str] = []
    document_semantics.check_document_semantic_boundaries(errors)

    assert len(errors) == 1
    assert "document_schema.semantics" in errors[0]


def test_rejects_direct_legacy_compat_import_outside_boundary(
    tmp_path: Path,
    monkeypatch,
) -> None:
    translation_root = tmp_path / "translation"
    rendering_root = tmp_path / "rendering"
    translation_root.mkdir()
    rendering_root.mkdir()
    (rendering_root / "layout.py").write_text(
        "from retainpdf_pipeline.ocr.document_schema.legacy_compat import resolve_legacy_block_class\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(document_semantics, "TRANSLATION_ROOT", translation_root)
    monkeypatch.setattr(document_semantics, "RENDERING_ROOT", rendering_root)
    monkeypatch.setattr(document_semantics, "PACKAGE_ROOT", tmp_path / "empty-package")
    monkeypatch.setattr(document_semantics, "LEGACY_COMPAT_IMPORTERS", set())

    errors: list[str] = []
    document_semantics.check_document_semantic_boundaries(errors)

    assert len(errors) == 1
    assert "compatibility boundary" in errors[0]


def test_rejects_decision_diff_import_from_production_package(
    tmp_path: Path,
    monkeypatch,
) -> None:
    package_root = tmp_path / "retainpdf_pipeline"
    translation_root = package_root / "translate"
    rendering_root = package_root / "render"
    translation_root.mkdir(parents=True)
    rendering_root.mkdir(parents=True)
    (package_root / "runtime.py").write_text(
        "from retainpdf_pipeline.ocr.document_schema.decision_diff import audit_document\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(document_semantics, "TRANSLATION_ROOT", translation_root)
    monkeypatch.setattr(document_semantics, "RENDERING_ROOT", rendering_root)
    monkeypatch.setattr(document_semantics, "PACKAGE_ROOT", package_root)

    errors: list[str] = []
    document_semantics.check_document_semantic_boundaries(errors)

    assert len(errors) == 1
    assert "migration audit helper" in errors[0]


def test_rejects_direct_legacy_field_read_from_consumer(
    tmp_path: Path,
    monkeypatch,
) -> None:
    translation_root = tmp_path / "translation"
    rendering_root = tmp_path / "rendering"
    translation_root.mkdir()
    rendering_root.mkdir()
    (translation_root / "policy.py").write_text(
        "def classify(item):\n"
        "    return item.get('raw_block_type') or item['normalized_sub_type']\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(document_semantics, "TRANSLATION_ROOT", translation_root)
    monkeypatch.setattr(document_semantics, "RENDERING_ROOT", rendering_root)
    monkeypatch.setattr(document_semantics, "PACKAGE_ROOT", tmp_path / "empty-package")
    monkeypatch.setattr(document_semantics, "LEGACY_FIELD_READERS", set())

    errors: list[str] = []
    document_semantics.check_document_semantic_boundaries(errors)

    assert len(errors) == 1
    assert "normalized_sub_type, raw_block_type" in errors[0]
