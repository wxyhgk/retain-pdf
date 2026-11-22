from retainpdf_pipeline.foundation.config import fonts


def test_default_font_uses_first_existing_bundled_fallback(tmp_path, monkeypatch):
    missing = tmp_path / "custom"
    bundled = tmp_path / "bundled"
    bundled.mkdir()
    expected = bundled / "SourceHanSerifSC-Regular.otf"
    expected.touch()
    monkeypatch.delenv("RETAIN_PDF_FONT_PATH", raising=False)
    monkeypatch.setattr(fonts, "BACKEND_FONTS_DIRS", [missing, bundled])
    assert fonts._default_font_path() == expected


def test_explicit_default_font_is_not_silently_replaced(tmp_path, monkeypatch):
    override = tmp_path / "operator-selected.ttf"
    monkeypatch.setenv("RETAIN_PDF_FONT_PATH", str(override))
    assert fonts._default_font_path() == override


# ---- 按需下载的字体、Typst（docs/ops/planning/desktop-size/，2026-11-22）：模块导入时就定，所以在新进程里看 ----

import json
import os
import subprocess
import sys
from pathlib import Path

_PROBE = (
    "import json\n"
    "from retainpdf_pipeline.foundation.config import fonts, external_tools\n"
    "try:\n"
    "    typst = external_tools.resolve_typst_bin()\n"
    "except external_tools.ExternalToolNotFound:\n"
    "    typst = None\n"
    "print(json.dumps({'dirs': [str(d) for d in fonts.BACKEND_FONTS_DIRS], 'font': str(fonts.DEFAULT_FONT_PATH),\n"
    "    'bold': str(fonts.TITLE_BOLD_FONT_PATH), 'family': fonts.TYPST_DEFAULT_FONT_FAMILY,\n"
    "    'fallback': fonts.USING_FALLBACK_CJK_FONT, 'typst': typst}))\n"
)


def _probe(tmp_path: Path, project: Path, data_root: Path) -> dict:
    env = {key: value for key, value in os.environ.items() if not key.startswith(("RETAIN_PDF_", "TYPST_BIN"))}
    env.update({"RETAIN_PDF_PROJECT_ROOT": str(project), "RUST_API_DATA_ROOT": str(data_root), "PATH": str(tmp_path / "empty-path")})
    out = subprocess.run([sys.executable, "-c", _PROBE], env=env, capture_output=True, text=True, check=True, cwd=tmp_path)
    return json.loads(out.stdout)


def _cached(data_root: Path) -> tuple[Path, Path]:
    root = data_root / "runtime-assets"
    fonts_dir = root / "fonts" / "2.003R"
    typst_dir = root / "typst" / "0.15.1-test"
    fonts_dir.mkdir(parents=True)
    typst_dir.mkdir(parents=True)
    (fonts_dir / "SourceHanSerifSC-Regular.otf").write_bytes(b"r")
    (fonts_dir / "SourceHanSerifSC-Bold.otf").write_bytes(b"b")
    typst = typst_dir / ("typst.exe" if os.name == "nt" else "typst")
    typst.write_bytes(b"#!/bin/sh\n")
    typst.chmod(0o755)
    (root / "current.json").write_text(json.dumps({"schema": "runtime_assets.current.v1", "assets": {
        "fonts": {"version": "2.003R", "dir": "fonts/2.003R"},
        "typst": {"version": "0.15.1", "dir": "typst/0.15.1-test", "bin": typst.name},
    }}), encoding="utf-8")
    return fonts_dir, typst


def test_downloaded_fonts_and_typst_are_found_when_the_package_has_none(tmp_path: Path) -> None:
    project = tmp_path / "app"
    (project / "fonts").mkdir(parents=True)
    (project / "fonts" / "DroidSansFallbackFull.ttf").write_bytes(b"d")
    fonts_dir, typst = _cached(tmp_path / "data")
    seen = _probe(tmp_path, project, tmp_path / "data")
    assert str(fonts_dir) in seen["dirs"]
    assert seen["font"] == str(fonts_dir / "SourceHanSerifSC-Regular.otf")
    assert seen["bold"] == str(fonts_dir / "SourceHanSerifSC-Bold.otf")
    assert seen["family"] == "Source Han Serif SC" and seen["fallback"] is False
    assert seen["typst"] == str(typst)


def test_without_network_the_bundled_fallback_font_is_used(tmp_path: Path) -> None:
    project = tmp_path / "app"
    (project / "fonts").mkdir(parents=True)
    fallback = project / "fonts" / "DroidSansFallbackFull.ttf"
    fallback.write_bytes(b"d")
    seen = _probe(tmp_path, project, tmp_path / "data")
    assert seen["font"] == str(fallback) and seen["bold"] == str(fallback)
    assert seen["family"] == "Droid Sans Fallback" and seen["fallback"] is True
    assert seen["typst"] is None


def test_fonts_in_the_package_come_before_the_download(tmp_path: Path) -> None:
    project = tmp_path / "app"
    (project / "fonts").mkdir(parents=True)
    bundled = project / "fonts" / "SourceHanSerifSC-Regular.otf"
    bundled.write_bytes(b"r")
    _cached(tmp_path / "data")
    seen = _probe(tmp_path, project, tmp_path / "data")
    assert seen["font"] == str(bundled)


def test_a_record_pointing_outside_the_cache_is_ignored(tmp_path: Path) -> None:
    root = tmp_path / "data" / "runtime-assets"
    root.mkdir(parents=True)
    (tmp_path / "elsewhere").mkdir()
    (root / "current.json").write_text(json.dumps({"assets": {"fonts": {"dir": "../../elsewhere"}}}), encoding="utf-8")
    project = tmp_path / "app"
    (project / "fonts").mkdir(parents=True)
    seen = _probe(tmp_path, project, tmp_path / "data")
    assert str(tmp_path / "elsewhere") not in seen["dirs"]
