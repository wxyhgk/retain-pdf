"""原子写：仓库里唯一一份实现，Windows 上目标被占用时退避重试（2026-11-26，状态管理 Z5 / S33、翻译状态审查二级 #13）。"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from retainpdf_base import io as base_io
from retainpdf_base.io import load_json
from retainpdf_base.io import save_json_atomic


class _Flaky:
    """前 `failures` 次 os.replace 抛 `error`，之后照常换名。"""

    def __init__(self, failures: int, error: OSError) -> None:
        self.failures = failures
        self.error = error
        self.calls = 0
        self.real = os.replace

    def __call__(self, source, target) -> None:  # noqa: ANN001
        self.calls += 1
        if self.calls <= self.failures:
            raise self.error
        self.real(source, target)


def _windows(monkeypatch: pytest.MonkeyPatch, *, windows: bool) -> list[float]:
    sleeps: list[float] = []
    monkeypatch.setattr(base_io, "_IS_WINDOWS", windows, raising=False)
    monkeypatch.setattr(base_io, "_sleep", sleeps.append, raising=False)
    return sleeps


def _winerror(code: int) -> OSError:
    error = OSError(13, "file is being used by another process")
    error.winerror = code  # type: ignore[attr-defined]
    return error


def test_atomic_write_retries_with_backoff_while_windows_holds_the_target(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    sleeps = _windows(monkeypatch, windows=True)
    flaky = _Flaky(3, PermissionError(13, "Access is denied"))
    monkeypatch.setattr(os, "replace", flaky)
    target = tmp_path / "page-1.json"
    save_json_atomic(target, {"ok": True})
    assert load_json(target) == {"ok": True}
    assert flaky.calls == 4
    assert len(sleeps) == 3 and sleeps == sorted(sleeps) and sleeps[1] == 2 * sleeps[0]
    assert not list(tmp_path.glob(".*.tmp")), "临时文件要换上或删掉"


@pytest.mark.parametrize("code", [5, 32, 33])
def test_atomic_write_retries_windows_sharing_violations(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, code: int
) -> None:
    _windows(monkeypatch, windows=True)
    flaky = _Flaky(1, _winerror(code))
    monkeypatch.setattr(os, "replace", flaky)
    save_json_atomic(tmp_path / "a.json", [1])
    assert flaky.calls == 2


def test_atomic_write_gives_up_after_about_two_seconds(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps = _windows(monkeypatch, windows=True)
    flaky = _Flaky(10**6, PermissionError(13, "Access is denied"))
    monkeypatch.setattr(os, "replace", flaky)
    target = tmp_path / "a.json"
    target.write_text('{"old": true}', encoding="utf-8")
    with pytest.raises(PermissionError):
        save_json_atomic(target, {"new": True})
    assert len(sleeps) == 10
    assert 1.5 <= sum(sleeps) <= 2.5
    assert load_json(target) == {"old": True}
    assert not list(tmp_path.glob(".*.tmp"))


def test_atomic_write_does_not_retry_off_windows_or_on_other_errors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    sleeps = _windows(monkeypatch, windows=False)
    monkeypatch.setattr(os, "replace", _Flaky(1, PermissionError(13, "denied")))
    with pytest.raises(PermissionError):
        save_json_atomic(tmp_path / "a.json", {})
    _windows(monkeypatch, windows=True)
    monkeypatch.setattr(os, "replace", _Flaky(1, FileNotFoundError(2, "gone")))
    with pytest.raises(FileNotFoundError):
        save_json_atomic(tmp_path / "b.json", {})
    assert sleeps == []


def test_atomic_write_keeps_the_old_file_when_serialization_fails(tmp_path: Path) -> None:
    target = tmp_path / "document.v1.json"
    save_json_atomic(target, {"pages": [1]})
    with pytest.raises(TypeError):
        save_json_atomic(target, {"pages": ["x" * 100_000, object()]})
    assert load_json(target) == {"pages": [1]}
    assert not list(tmp_path.glob(".*.tmp"))
