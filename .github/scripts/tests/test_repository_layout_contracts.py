from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import unquote


REPO_ROOT = Path(__file__).resolve().parents[3]
DOCS_ROOT = REPO_ROOT / "docs"
MARKDOWN_LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def test_legacy_root_directories_are_absent() -> None:
    for name in ("doc", "scripts", "src", "apps", "packages", "infra"):
        assert not (REPO_ROOT / name).exists(), f"legacy root directory returned: {name}/"


def test_responsibility_roots_and_shared_package_ownership() -> None:
    for name in ("frontend", "backend", "database", "tests", "ops", "security", "contracts"):
        assert (REPO_ROOT / name).is_dir(), f"missing responsibility root: {name}/"
    for name in ("frontend/packages", "backend/packages"):
        assert (REPO_ROOT / name).is_dir(), f"missing scoped package directory: {name}/"


def test_rust_workspace_uses_root_manifest_and_lock() -> None:
    assert (REPO_ROOT / "Cargo.toml").is_file()
    assert (REPO_ROOT / "Cargo.lock").is_file()
    assert not (REPO_ROOT / "backend/api/Cargo.lock").exists()


def test_documentation_has_one_canonical_root() -> None:
    assert (DOCS_ROOT / "README.md").is_file()
    for section in ("core", "api", "adr", "reference", "ops"):
        assert (DOCS_ROOT / section).is_dir(), f"missing docs section: {section}/"


def test_npm_workspaces_share_the_root_lockfile() -> None:
    manifest = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    assert (REPO_ROOT / "package-lock.json").is_file()

    nested_locks: list[str] = []
    for pattern in manifest["workspaces"]:
        for workspace in REPO_ROOT.glob(pattern):
            lockfile = workspace / "package-lock.json"
            if lockfile.exists():
                nested_locks.append(str(lockfile.relative_to(REPO_ROOT)))

    assert nested_locks == [], "workspace lockfiles must be removed: " + ", ".join(nested_locks)


def test_documentation_relative_links_resolve() -> None:
    broken: list[str] = []
    for markdown in sorted(DOCS_ROOT.rglob("*.md")):
        content = markdown.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK.findall(content):
            target = raw_target.strip()
            if not target or target.startswith(("#", "http://", "https://", "mailto:", "data:")):
                continue
            target = target.split("#", 1)[0].strip()
            if not target or target == "...":
                continue
            if target.startswith("<") and target.endswith(">"):
                target = target[1:-1]
            resolved = (markdown.parent / unquote(target)).resolve()
            if not resolved.exists():
                broken.append(
                    f"{markdown.relative_to(REPO_ROOT)} -> {raw_target}"
                )
    assert broken == [], "broken documentation links:\n" + "\n".join(broken)
