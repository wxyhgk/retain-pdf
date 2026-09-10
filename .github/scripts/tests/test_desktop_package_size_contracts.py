from __future__ import annotations

import json
from pathlib import Path


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_ROOT.parents[1]


def _text(relative: str) -> str:
    return (REPO_ROOT / relative).read_text(encoding="utf-8")


def test_desktop_package_does_not_duplicate_backend_fonts() -> None:
    package = json.loads(_text("frontend/desktop/package.json"))

    assert "assets/**/*" in package["build"]["files"]
    assert "!assets/fonts/**/*" in package["build"]["files"]


def test_desktop_package_keeps_only_supported_electron_locales() -> None:
    package = json.loads(_text("frontend/desktop/package.json"))
    build = package["build"]

    assert build["mac"]["electronLanguages"] == ["en", "zh_CN", "zh_TW"]
    assert build["win"]["electronLanguages"] == ["en-US", "zh-CN", "zh-TW"]
    assert build["linux"]["electronLanguages"] == ["en-US", "zh-CN", "zh-TW"]


def test_prepare_app_excludes_development_frontend_payloads() -> None:
    prepare = _text("frontend/desktop/scripts/prepare-app.mjs")

    assert "desktopFrontendRuntimeEntries" in prepare
    for entry in [
        '"index.html"',
        '"detail.html"',
        '"reader.html"',
        '"dist"',
        '"src"',
        '"decor"',
        '"vendor"',
    ]:
        assert entry in prepare
    assert 'parts[1] === "assets"' in prepare


def test_prepare_app_copies_only_canonical_pipeline_runtime() -> None:
    prepare = _text("frontend/desktop/scripts/prepare-app.mjs")

    assert "canonicalPipelineEntries" in prepare
    assert '"entrypoints"' in prepare
    assert '"retainpdf_pipeline"' in prepare
    assert "canonicalPipelineEntries.has(parts[0])" in prepare
    assert 'part === "__pycache__"' in prepare


def test_prepare_app_prunes_non_runtime_python_payloads() -> None:
    prepare = _text("frontend/desktop/scripts/prepare-app.mjs")
    prune = _text("frontend/desktop/scripts/runtime-prune.mjs")

    assert "pruneBundledMacPythonRuntime" in prepare
    assert "pruneBundledPortablePythonRuntime" in prepare
    for payload in [
        '"Documentation"',
        '"ensurepip"',
        '"idlelib"',
        '"tkinter"',
        '"pip"',
        '"setuptools"',
        '"__pycache__"',
    ]:
        assert payload in prune
