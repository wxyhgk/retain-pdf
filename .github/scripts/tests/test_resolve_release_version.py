from __future__ import annotations

from pathlib import Path
import sys

import pytest


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_ROOT.parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))

from resolve_release_version import resolve_release_version


@pytest.mark.parametrize(
    ("tag", "version", "prerelease", "stable"),
    [
        ("4.2.0-beta1", "4.2.0-beta1", "true", "false"),
        ("v4.2.0-beta.1+build.7", "4.2.0-beta.1+build.7", "true", "false"),
        ("4.2.0", "4.2.0", "false", "true"),
        ("v4.2.0", "4.2.0", "false", "true"),
    ],
)
def test_resolves_release_tags(
    tag: str,
    version: str,
    prerelease: str,
    stable: str,
) -> None:
    assert resolve_release_version(tag) == {
        "tag": tag,
        "version": version,
        "prerelease": prerelease,
        "stable": stable,
    }


@pytest.mark.parametrize("tag", ["", "release/4.2.0", "4.2", "04.2.0", "4.2.0 beta"])
def test_rejects_invalid_release_tags(tag: str) -> None:
    with pytest.raises(ValueError, match="invalid release reference"):
        resolve_release_version(tag)


def test_manual_docker_build_can_use_safe_label_without_marking_it_stable() -> None:
    assert resolve_release_version("dev", allow_label=True) == {
        "tag": "dev",
        "version": "dev",
        "prerelease": "true",
        "stable": "false",
    }


@pytest.mark.parametrize("tag", ["feature/test", "two words", "bad:tag", "../latest"])
def test_manual_docker_label_rejects_unsafe_values(tag: str) -> None:
    with pytest.raises(ValueError, match="invalid release reference"):
        resolve_release_version(tag, allow_label=True)


@pytest.mark.parametrize("workflow_name", ["release-desktop.yml", "release-docker.yml"])
def test_release_workflows_accept_prefixed_and_unprefixed_version_tags(
    workflow_name: str,
) -> None:
    workflow = (REPO_ROOT / ".github" / "workflows" / workflow_name).read_text(
        encoding="utf-8"
    )

    assert "v[0-9]*.[0-9]*.[0-9]*" in workflow
    assert "[0-9]*.[0-9]*.[0-9]*" in workflow
    assert "resolve_release_version.py" in workflow


def test_desktop_release_is_published_once_after_all_platforms_finish() -> None:
    workflow = (
        REPO_ROOT / ".github" / "workflows" / "release-desktop.yml"
    ).read_text(encoding="utf-8")

    assert workflow.count("resolve_release_version.py") == 4
    assert workflow.count("uses: softprops/action-gh-release@v3") == 1
    assert workflow.count("prerelease: ${{ steps.version.outputs.prerelease == 'true' }}") == 1
    assert "publish-desktop-release:" in workflow
    assert "- build-windows-release" in workflow
    assert "- build-linux-release" in workflow
    assert "- build-macos-release" in workflow
    assert "release-assets/SHA256SUMS.txt" in workflow
    assert 'tag = "v$version"' not in workflow


def test_docker_latest_is_promoted_only_after_candidates_are_verified() -> None:
    workflow = (
        REPO_ROOT / ".github" / "workflows" / "release-docker.yml"
    ).read_text(encoding="utf-8")

    assert "Verify both candidate images" in workflow
    assert "Promote complete Docker release" in workflow
    assert "STABLE_RELEASE: ${{ steps.release.outputs.stable }}" in workflow
    assert 'if [ "$STABLE_RELEASE" = "true" ]; then' in workflow
    assert workflow.index("Verify both candidate images") < workflow.index(
        "Promote complete Docker release"
    )
    assert "startsWith(github.ref, 'refs/tags/v')" not in workflow
