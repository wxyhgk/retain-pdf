"""MinerU 的 token 和服务商清单同一个名字（RETAIN_MINERU_API_TOKEN），旧名 MINERU_API_TOKEN 照旧认。

以前直连这条路只读 MINERU_API_TOKEN，清单、Rust、文档写的都是 RETAIN_MINERU_API_TOKEN；报错还让人去
不存在的 scripts/.env/（2026-11-02 整理时查出）。"""

from __future__ import annotations

from pathlib import Path

from retainpdf_base import local_env
from retainpdf_pipeline.ocr.mineru_provider import mineru_api


def _no_secrets(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(local_env, "ENV_DIR", tmp_path)
    monkeypatch.delenv("RETAIN_MINERU_API_TOKEN", raising=False)
    monkeypatch.delenv("MINERU_API_TOKEN", raising=False)


def test_the_catalog_name_and_the_old_name_both_work(monkeypatch, tmp_path: Path) -> None:
    _no_secrets(monkeypatch, tmp_path)
    assert mineru_api.resolve_mineru_token() == ""
    monkeypatch.setenv("MINERU_API_TOKEN", "old-name")
    assert mineru_api.resolve_mineru_token() == "old-name"
    monkeypatch.setenv("RETAIN_MINERU_API_TOKEN", "catalog-name")
    assert mineru_api.resolve_mineru_token() == "catalog-name"
    assert mineru_api.resolve_mineru_token("from-flag") == "from-flag"


def test_the_local_env_file_takes_the_catalog_name(monkeypatch, tmp_path: Path) -> None:
    _no_secrets(monkeypatch, tmp_path)
    (tmp_path / mineru_api.MINERU_ENV_FILE).write_text("RETAIN_MINERU_API_TOKEN=from-file\n", encoding="utf-8")
    assert mineru_api.resolve_mineru_token() == "from-file"


def test_the_missing_token_message_points_to_the_real_place() -> None:
    message = mineru_api.missing_mineru_token_message("--token")
    assert "RETAIN_MINERU_API_TOKEN" in message and "backend/pipeline/.env/mineru.env" in message
    assert "scripts/.env" not in message
