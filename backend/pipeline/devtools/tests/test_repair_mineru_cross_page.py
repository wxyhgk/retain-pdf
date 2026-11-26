from __future__ import annotations

import importlib.util
import os
from copy import deepcopy
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "repair_mineru_cross_page",
    Path(__file__).parents[1] / "repair_mineru_cross_page.py",
)
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


def _block(block_id: str, page: int, path: str, text: str = "unchanged source") -> dict:
    return {
        "block_id": block_id,
        "page_index": page,
        "order": 1,
        "text": text,
        "source": {"raw_path": path},
        "metadata": {},
    }


def test_repair_mapping_requires_unique_text_and_raw_source() -> None:
    old = _block("p001-b0001", 0, "/pdf_info/0/para_blocks/0")
    new = _block("p002-b0001", 1, "/pdf_info/1/para_blocks/0")
    new["metadata"]["cross_page_source_paths"] = [old["source"]["raw_path"]]
    mapping = repair.build_block_mapping(
        {"pages": [{"blocks": [old]}]}, {"pages": [{"blocks": [new]}]}
    )
    assert mapping[old["block_id"]] == new
    with pytest.raises(ValueError, match="matches"):
        repair.build_block_mapping(
            {"pages": [{"blocks": [old]}]},
            {"pages": [{"blocks": [new, deepcopy(new)]}]},
        )
    new["text"] = "different source"
    with pytest.raises(ValueError, match="matches"):
        repair.build_block_mapping(
            {"pages": [{"blocks": [old]}]}, {"pages": [{"blocks": [new]}]}
        )


def test_repair_refuses_existing_or_nested_output_before_any_write(
    tmp_path: Path,
) -> None:
    source = tmp_path / "original"
    source.mkdir()
    for output in (source, source / "nested", tmp_path):
        with pytest.raises(ValueError, match="new, separate"):
            repair.prepare_repaired_job(source, output)
    assert list(source.iterdir()) == []


def test_repair_summary_is_atomic_and_cleans_failed_temporary_file(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "artifacts/mineru-cross-page-repair.json"
    path.parent.mkdir()
    path.write_text("original summary", encoding="utf-8")

    def fail_replace(*args):
        raise OSError("simulated replace failure")

    monkeypatch.setattr(os, "replace", fail_replace)
    with pytest.raises(OSError, match="simulated replace failure"):
        repair._write_repair_summary(path, {"provider_calls": 0})
    assert path.read_text(encoding="utf-8") == "original summary"
    assert list(path.parent.iterdir()) == [path]
