"""Offline checks for the aggregate backend source delivery contract."""
from __future__ import annotations

import importlib.util
import io
import json
from pathlib import Path
import sys
import tarfile

import pytest

RELEASE_ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_source_archive", RELEASE_ROOT / "build_source_archive.py")
assert spec and spec.loader
archive_tool = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = archive_tool
spec.loader.exec_module(archive_tool)


def make_archive(path: Path, *, omit: str = "", extra: str = "") -> dict:
    provenance = {"schema": "retainpdf_backend_source_v1", "version": "test"}
    with tarfile.open(path, "w:gz") as archive:
        files = {name: b"fixture" for name in archive_tool.REQUIRED_FILES if name != omit}
        files["SOURCE.json"] = json.dumps(provenance).encode()
        if extra:
            files[extra] = b"unsafe"
        for name, payload in files.items():
            member = tarfile.TarInfo("source/" + name)
            member.size = len(payload)
            archive.addfile(member, io.BytesIO(payload))
    return provenance


def test_aggregate_archive_accepts_required_layout(tmp_path: Path) -> None:
    path = tmp_path / "source.tar.gz"
    provenance = make_archive(path)
    archive_tool._validate_archive(path, prefix="source/", provenance=provenance)


@pytest.mark.parametrize("missing", ["Cargo.toml", "backend/api/Cargo.toml", "resources/fonts/LICENSE-OFL-1.1.txt"])
def test_aggregate_archive_rejects_missing_components(tmp_path: Path, missing: str) -> None:
    path = tmp_path / "source.tar.gz"
    provenance = make_archive(path, omit=missing)
    with pytest.raises(RuntimeError, match="incomplete"):
        archive_tool._validate_archive(path, prefix="source/", provenance=provenance)


def test_archive_rejects_parent_traversal(tmp_path: Path) -> None:
    path = tmp_path / "source.tar.gz"
    provenance = make_archive(path, extra="../escape")
    with pytest.raises(RuntimeError, match="unsafe"):
        archive_tool._validate_archive(path, prefix="source/", provenance=provenance)


def test_archive_scope_excludes_runtime_data_and_frontend() -> None:
    assert "backend" in archive_tool.ARCHIVE_PATHS
    assert "database" in archive_tool.ARCHIVE_PATHS
    assert "Cargo.lock" in archive_tool.ARCHIVE_PATHS
    assert not {"data", "var", "frontend"}.intersection(archive_tool.ARCHIVE_PATHS)
