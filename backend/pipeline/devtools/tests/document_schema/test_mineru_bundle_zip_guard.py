from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import pytest


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.mineru import artifacts


def _write_zip(path: Path, *, file_count: int = 1) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        for index in range(file_count):
            zf.writestr(f"entry-{index}.txt", "hello")


def test_ensure_zip_within_limits_accepts_small_bundle(tmp_path: Path) -> None:
    zip_path = tmp_path / "bundle.zip"
    _write_zip(zip_path)

    with zipfile.ZipFile(zip_path, "r") as zf:
        artifacts.ensure_zip_within_limits(zf, zip_path=zip_path)


def test_ensure_zip_within_limits_rejects_huge_declared_uncompressed_size(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    zip_path = tmp_path / "bundle.zip"
    _write_zip(zip_path)

    monkeypatch.setenv(artifacts.MINERU_BUNDLE_MAX_UNCOMPRESSED_BYTES_ENV, "100")

    with zipfile.ZipFile(zip_path, "r") as zf:
        # Simulate a hostile/malformed bundle whose central directory declares
        # a far larger uncompressed size than the small archive actually
        # contains -- this is the "zip bomb" shape the guard defends against,
        # and it must be caught before extractall() ever runs.
        for info in zf.infolist():
            info.file_size = 10 * 1024 * 1024 * 1024  # 10 GiB declared, tiny archive on disk.

        with pytest.raises(RuntimeError, match="uncompressed size"):
            artifacts.ensure_zip_within_limits(zf, zip_path=zip_path)


def test_ensure_zip_within_limits_rejects_absurd_entry_count(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    zip_path = tmp_path / "bundle.zip"
    _write_zip(zip_path, file_count=5)

    monkeypatch.setenv(artifacts.MINERU_BUNDLE_MAX_ENTRIES_ENV, "3")

    with zipfile.ZipFile(zip_path, "r") as zf:
        with pytest.raises(RuntimeError, match="entries exceeds limit"):
            artifacts.ensure_zip_within_limits(zf, zip_path=zip_path)


def test_unpack_zip_refuses_to_extract_when_over_limit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    zip_path = tmp_path / "bundle.zip"
    dest_dir = tmp_path / "unpacked"
    _write_zip(zip_path)

    monkeypatch.setenv(artifacts.MINERU_BUNDLE_MAX_UNCOMPRESSED_BYTES_ENV, "1")

    with pytest.raises(RuntimeError, match="uncompressed size"):
        artifacts.unpack_zip(zip_path, dest_dir)

    # dest_dir may be created up front, but nothing should have been extracted into it.
    assert not dest_dir.exists() or list(dest_dir.iterdir()) == []


def test_mineru_job_reuses_shared_guarded_unpack_zip() -> None:
    from retainpdf_pipeline.ocr.mineru import mineru_job

    assert mineru_job.unpack_zip is artifacts.unpack_zip
