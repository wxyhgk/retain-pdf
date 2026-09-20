import os
import stat

import pytest

from retainpdf_pipeline.foundation.config.external_tools import ExternalToolNotFound
from retainpdf_pipeline.foundation.config.external_tools import resolve_typst_bin


def _make_executable(path):
    path.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def test_explicit_path_wins_over_path_lookup(tmp_path, monkeypatch):
    explicit = _make_executable(tmp_path / "typst")
    other = tmp_path / "elsewhere"
    other.mkdir()
    _make_executable(other / "typst")
    monkeypatch.setenv("TYPST_BIN", str(explicit))
    monkeypatch.setenv("PATH", str(other))
    assert resolve_typst_bin() == str(explicit)


def test_falls_back_to_path_lookup_when_unset(tmp_path, monkeypatch):
    discovered = _make_executable(tmp_path / "typst")
    monkeypatch.delenv("TYPST_BIN", raising=False)
    monkeypatch.setenv("PATH", str(tmp_path))
    assert resolve_typst_bin() == str(discovered)


def test_bare_command_in_typst_bin_is_resolved_through_path(tmp_path, monkeypatch):
    discovered = _make_executable(tmp_path / "typst-nightly")
    monkeypatch.setenv("TYPST_BIN", "typst-nightly")
    monkeypatch.setenv("PATH", str(tmp_path))
    assert resolve_typst_bin() == str(discovered)


def test_missing_binary_names_the_two_ways_to_fix_it(tmp_path, monkeypatch):
    monkeypatch.delenv("TYPST_BIN", raising=False)
    monkeypatch.setenv("PATH", str(tmp_path))
    with pytest.raises(ExternalToolNotFound) as excinfo:
        resolve_typst_bin()
    message = str(excinfo.value)
    assert "TYPST_BIN" in message
    assert "PATH" in message


def test_typst_bin_pointing_at_nothing_is_reported_as_such(tmp_path, monkeypatch):
    # 不能静默回落到 PATH：配了 TYPST_BIN 却没生效，比找不到还难查。
    _make_executable(tmp_path / "typst")
    monkeypatch.setenv("TYPST_BIN", str(tmp_path / "does-not-exist"))
    monkeypatch.setenv("PATH", str(tmp_path))
    with pytest.raises(ExternalToolNotFound) as excinfo:
        resolve_typst_bin()
    assert "does-not-exist" in str(excinfo.value)


def test_non_executable_file_is_not_accepted(tmp_path, monkeypatch):
    plain = tmp_path / "typst"
    plain.write_text("not a program", encoding="utf-8")
    plain.chmod(plain.stat().st_mode & ~stat.S_IXUSR & ~stat.S_IXGRP & ~stat.S_IXOTH)
    monkeypatch.setenv("TYPST_BIN", str(plain))
    with pytest.raises(ExternalToolNotFound):
        resolve_typst_bin()


def test_resolution_is_not_cached_at_import_time(tmp_path, monkeypatch):
    # 这是把 TYPST_BIN 从模块级常量改成函数的全部理由：桌面端/测试可能在
    # import 之后才设好环境变量。
    first = _make_executable(tmp_path / "first")
    second = _make_executable(tmp_path / "second")
    monkeypatch.setenv("TYPST_BIN", str(first))
    assert resolve_typst_bin() == str(first)
    monkeypatch.setenv("TYPST_BIN", str(second))
    assert resolve_typst_bin() == str(second)


def test_no_platform_specific_path_is_guessed(monkeypatch):
    # 旧实现回落到 /snap/bin/typst——一个 Linux snap 路径，在 macOS/Windows 上
    # 只会抛出没有上下文的 FileNotFoundError。
    monkeypatch.delenv("TYPST_BIN", raising=False)
    monkeypatch.setenv("PATH", "")
    with pytest.raises(ExternalToolNotFound):
        resolve_typst_bin()
