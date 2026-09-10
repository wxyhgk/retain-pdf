from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys

import pytest


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_ROOT.parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))

from resolve_backend_source import REQUIRED_PATHS, REQUIRED_ROOT_PATHS, resolve_backend_source


BACKEND_WORKFLOWS = (
    "tests.yml",
    "release-docker.yml",
    "release-desktop.yml",
    "rust-api-architecture.yml",
    "translation-replay.yml",
    "translate-sample-pdf.yml",
)


def _git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def _write_backend_layout(root: Path) -> None:
    for relative in REQUIRED_PATHS:
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"fixture for {relative}\n", encoding="utf-8")


def _commit_repo(root: Path) -> None:
    _git(root, "init", "-q")
    _git(root, "add", ".")
    _git(
        root,
        "-c",
        "user.name=RetainPDF Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "-qm",
        "fixture",
    )


def _product_repo(tmp_path: Path) -> tuple[Path, str, str]:
    repo_root = tmp_path / "product"
    _write_backend_layout(repo_root / "backend")
    for relative in REQUIRED_ROOT_PATHS:
        path = repo_root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"fixture for {relative}\n", encoding="utf-8")
    (repo_root / "backend-package.json").write_text(
        json.dumps({"schema_version": 1, "source_path": "backend"}),
        encoding="utf-8",
    )
    _commit_repo(repo_root)
    return (
        repo_root,
        _git(repo_root, "rev-parse", "HEAD"),
        _git(repo_root, "rev-parse", "HEAD^{tree}"),
    )


def _rewrite_manifest(repo_root: Path, **updates: object) -> None:
    manifest_path = repo_root / "backend-package.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload.update(updates)
    manifest_path.write_text(json.dumps(payload), encoding="utf-8")


def test_resolves_verified_embedded_backend_package(tmp_path: Path) -> None:
    repo_root, revision, source_tree = _product_repo(tmp_path)

    assert resolve_backend_source(repo_root) == {
        "path": str((repo_root / "backend").resolve()),
        "source_root": str(repo_root.resolve()),
        "kind": "embedded-package",
        "revision": revision,
        "tree": source_tree,
        "dirty": "false",
    }


def test_environment_cannot_redirect_backend_outside_product_repo(
    tmp_path: Path,
    monkeypatch,
) -> None:
    repo_root, _revision, source_tree = _product_repo(tmp_path)
    outside = tmp_path / "outside-backend"
    _write_backend_layout(outside)
    _commit_repo(outside)
    monkeypatch.setenv("RETAIN_PDF_SERVICES_ROOT", str(outside))

    resolved = resolve_backend_source(repo_root)

    assert resolved["path"] == str((repo_root / "backend").resolve())
    assert resolved["tree"] == source_tree


def test_rejects_dirty_tracked_backend_by_default(tmp_path: Path) -> None:
    repo_root, _revision, source_tree = _product_repo(tmp_path)
    (repo_root / "backend" / "pyproject.toml").write_text("dirty\n", encoding="utf-8")

    with pytest.raises(RuntimeError, match="uncommitted changes"):
        resolve_backend_source(repo_root)

    resolved = resolve_backend_source(repo_root, allow_dirty=True)
    assert resolved["tree"] == source_tree
    assert resolved["dirty"] == "true"


def test_rejects_untracked_backend_file_by_default(tmp_path: Path) -> None:
    repo_root, _revision, _source_tree = _product_repo(tmp_path)
    (repo_root / "backend" / "new-source.py").write_text("pass\n", encoding="utf-8")

    with pytest.raises(RuntimeError, match="uncommitted changes"):
        resolve_backend_source(repo_root)

    assert resolve_backend_source(repo_root, allow_dirty=True)["dirty"] == "true"


def test_rejects_unsupported_manifest_schema(tmp_path: Path) -> None:
    repo_root, _revision, _source_tree = _product_repo(tmp_path)
    _rewrite_manifest(repo_root, schema_version=2)

    with pytest.raises(RuntimeError, match="unsupported backend package schema"):
        resolve_backend_source(repo_root)


@pytest.mark.parametrize("relative", ["Cargo.toml", "resources/fonts/new-font.txt", "database/retain-db/src/lib.rs", "contracts/new.schema.json"])
def test_aggregate_dependencies_participate_in_dirty_check(tmp_path: Path, relative: str) -> None:
    repo_root, _revision, source_tree = _product_repo(tmp_path)
    path = repo_root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("changed aggregate dependency\n", encoding="utf-8")
    with pytest.raises(RuntimeError, match="uncommitted changes"):
        resolve_backend_source(repo_root)
    resolved = resolve_backend_source(repo_root, allow_dirty=True)
    assert resolved["dirty"] == "true"
    assert resolved["tree"] == source_tree


@pytest.mark.parametrize("unsafe_path", ["../backend", "/tmp/backend", "a\\backend", "."])
def test_rejects_unsafe_source_path(tmp_path: Path, unsafe_path: str) -> None:
    repo_root, _revision, _source_tree = _product_repo(tmp_path)
    _rewrite_manifest(repo_root, source_path=unsafe_path)

    with pytest.raises(RuntimeError, match="safe repository-relative path"):
        resolve_backend_source(repo_root)


def test_rejects_incomplete_backend_layout(tmp_path: Path) -> None:
    repo_root, _revision, _source_tree = _product_repo(tmp_path)
    (repo_root / "ops/deployment/docker/backend/Dockerfile.app").unlink()

    with pytest.raises(RuntimeError, match="layout is incomplete"):
        resolve_backend_source(repo_root, allow_dirty=True)


def test_manifest_declares_only_the_embedded_package_path() -> None:
    manifest = json.loads((REPO_ROOT / "backend-package.json").read_text(encoding="utf-8"))

    assert manifest == {"schema_version": 1, "source_path": "backend"}


def test_prepare_action_has_no_external_checkout_or_token() -> None:
    action = (
        REPO_ROOT / ".github" / "actions" / "prepare-backend-source" / "action.yml"
    ).read_text(encoding="utf-8")

    assert "resolve_backend_source.py" in action
    assert "actions/checkout" not in action
    assert "token:" not in action
    assert "repository:" not in action


@pytest.mark.parametrize("workflow_name", BACKEND_WORKFLOWS)
def test_backend_workflows_prepare_the_embedded_package(workflow_name: str) -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / workflow_name).read_text(
        encoding="utf-8"
    )

    assert "uses: ./.github/actions/prepare-backend-source" in workflow
    assert "BACKEND_REPOSITORY_TOKEN" not in workflow


@pytest.mark.parametrize("workflow_name", BACKEND_WORKFLOWS)
def test_backend_workflow_commands_do_not_bypass_the_package_resolver(
    workflow_name: str,
) -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / workflow_name).read_text(
        encoding="utf-8"
    )

    hardcoded_backend_lines = []
    for line in workflow.splitlines():
        stripped = line.strip()
        if stripped.startswith('- "backend/'):
            # Embedded package path filters intentionally trigger relevant jobs.
            continue
        if any(path in line for path in ("backend/api", "backend/ai", "backend/pipeline")):
            hardcoded_backend_lines.append(stripped)

    assert hardcoded_backend_lines == []


def test_local_backend_entrypoints_resolve_the_embedded_package() -> None:
    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    api_test = package["scripts"]["test:api"]
    assert ".github/scripts/run_with_backend_source.py" in api_test
    assert "{source_root}/Cargo.toml" in api_test

    wrapper = (REPO_ROOT / ".github" / "scripts" / "run_with_backend_source.py").read_text(
        encoding="utf-8"
    )
    assert "allow_dirty=True" in wrapper

    for relative in ("ops/deployment/docker/release-images.sh", "ops/deployment/docker/build-arm64.sh"):
        script = (REPO_ROOT / relative).read_text(encoding="utf-8")
        assert ".github/scripts/resolve_backend_source.py" in script
        assert '${SERVICES_ROOT}/../ops/deployment/docker/backend/Dockerfile.app' in script
