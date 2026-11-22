from pathlib import Path
import subprocess
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ci_scope import changed_paths, select_checks  # noqa: E402


@pytest.mark.parametrize(("event", "paths", "expected"), [
    ("pull_request", ["docs/reference/usage.md"], ("docs", False)),
    ("pull_request", ["frontend/web/src/App.tsx", "docs/ops/devlog/2026-11.csv"], ("frontend", False)),
    ("pull_request", ["frontend/web/src/App.tsx", "backend/api/src/lib.rs"], ("full", False)),
    ("pull_request", ["docs/api/00-接口目录.md"], ("full", False)),
    ("pull_request", ["docs/core/python/dependencies.json"], ("full", False)),
    ("pull_request", ["frontend/web/package.json"], ("full", False)),
    ("pull_request", ["database/retainpdf-db/Cargo.toml"], ("full", True)),
    ("pull_request", ["contracts/example.schema.json"], ("full", True)),
    ("pull_request", ["docs/.gitattributes"], ("full", True)),
    ("push", ["frontend/web/src/App.tsx"], ("full", False)),
    ("push", ["ops/deployment/docker/Dockerfile.web"], ("full", True)),
    ("workflow_dispatch", None, ("full", True)),
    ("pull_request", None, ("full", True)),
])
def test_check_scope(event, paths, expected):
    assert select_checks(event, paths) == expected


def test_pr_compares_merge_tree_to_base_and_counts_renames_out_of_backend(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    def git(*args):
        return subprocess.check_output(["git", *args], text=True).strip()

    git("init", "-q", "-b", "main")
    git("config", "user.email", "ci@example.test")
    git("config", "user.name", "CI")
    Path("backend").mkdir()
    Path("backend/old.rs").write_text("old\n")
    git("add", ".")
    git("commit", "-qm", "base")
    git("checkout", "-qb", "change")
    Path("frontend").mkdir()
    git("mv", "backend/old.rs", "frontend/moved.rs")
    git("commit", "-qm", "move a backend path")
    git("checkout", "-q", "main")
    Path("base-only.md").write_text("new base change\n")
    git("add", ".")
    git("commit", "-qm", "advance base")
    git("merge", "-q", "--no-ff", "--no-edit", "change")
    paths = changed_paths("pull_request", "branch", "", git("rev-parse", "HEAD"))
    assert set(paths or []) == {"backend/old.rs", "frontend/moved.rs"}
    assert select_checks("pull_request", paths) == ("full", False)
