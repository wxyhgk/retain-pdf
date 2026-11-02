"""共用缓存按修改时间过期（cache_ttl.py，2026-11-02）。"""

from __future__ import annotations

import os
import time
from pathlib import Path

from retainpdf_base import cache_ttl


def _write(path: Path, *, age_days: float) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{}", encoding="utf-8")
    stamp = time.time() - age_days * 86400
    os.utime(path, (stamp, stamp))
    return path


def test_old_files_go_new_ones_and_links_stay(tmp_path: Path) -> None:
    cache_ttl._reset_for_tests()
    root = tmp_path / "_agent_request_cache"
    old = _write(root / "ab" / "old.json", age_days=100)
    new = _write(root / "cd" / "new.json", age_days=1)
    outside = _write(tmp_path / "keep.json", age_days=500)
    link = root / "link.json"
    link.symlink_to(outside)
    assert cache_ttl.prune_expired_once(root, ttl=90 * 86400, label="test cache") == 1
    assert not old.exists() and new.exists() and link.is_symlink() and outside.exists()


def test_once_per_directory_and_zero_turns_it_off(tmp_path: Path) -> None:
    cache_ttl._reset_for_tests()
    root = tmp_path / "cache"
    _write(root / "a.json", age_days=100)
    assert cache_ttl.prune_expired_once(root, ttl=0, label="off") == 0
    assert (root / "a.json").exists()
    assert cache_ttl.prune_expired_once(root, ttl=86400, label="again") == 0, "only once per process"
    cache_ttl._reset_for_tests()
    assert cache_ttl.prune_expired_once(tmp_path / "missing", ttl=86400, label="missing") == 0


def test_ttl_from_env(monkeypatch) -> None:
    monkeypatch.delenv("RETAIN_TEST_CACHE_TTL_DAYS", raising=False)
    assert cache_ttl.ttl_seconds("RETAIN_TEST_CACHE_TTL_DAYS", 90) == 90 * 86400
    monkeypatch.setenv("RETAIN_TEST_CACHE_TTL_DAYS", "0")
    assert cache_ttl.ttl_seconds("RETAIN_TEST_CACHE_TTL_DAYS", 90) == 0
    monkeypatch.setenv("RETAIN_TEST_CACHE_TTL_DAYS", "soon")
    assert cache_ttl.ttl_seconds("RETAIN_TEST_CACHE_TTL_DAYS", 365) == 365 * 86400
