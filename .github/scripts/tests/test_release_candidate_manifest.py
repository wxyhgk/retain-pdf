"""预构建产物的身份记录与校验：版本、revision、文件名、sha256 任何一处不符都拒绝。"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

import pytest


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))

from release_candidate_manifest import (  # noqa: E402
    CandidateError,
    expected_desktop_file,
    main,
    record_desktop,
    verify_desktop,
    verify_docker,
)


SHA = "c" * 40
VERSION = "4.2.7"


def make_desktop_set(directory: Path, *, version=VERSION, revision=SHA) -> dict[str, Path]:
    files = {}
    for platform in ("windows", "linux", "macos"):
        package = directory / expected_desktop_file(platform, version)
        package.write_bytes(f"{platform}-package".encode())
        assert main([
            "record-desktop", "--platform", platform, "--file", str(package),
            "--version", version, "--revision", revision, "--out-dir", str(directory),
        ]) == 0
        files[platform] = package
    return files


def test_record_desktop_captures_identity_and_sha256(tmp_path):
    package = tmp_path / "RetainPDF-Mac-4.2.7.dmg"
    package.write_bytes(b"dmg")
    manifest = record_desktop(platform="macos", file=package, version=VERSION, revision=SHA)
    assert manifest == {
        "schema": 1,
        "platform": "macos",
        "file": "RetainPDF-Mac-4.2.7.dmg",
        "version": VERSION,
        "revision": SHA,
        "sha256": hashlib.sha256(b"dmg").hexdigest(),
        "size": 3,
    }


def test_record_desktop_rejects_a_package_named_for_another_version(tmp_path):
    package = tmp_path / "RetainPDF-Mac-4.2.6.dmg"
    package.write_bytes(b"dmg")
    with pytest.raises(CandidateError, match="does not match expected"):
        record_desktop(platform="macos", file=package, version=VERSION, revision=SHA)


def test_verify_desktop_accepts_a_complete_matching_set_and_writes_sums(tmp_path):
    make_desktop_set(tmp_path)
    sums = tmp_path / "SHA256SUMS.txt"
    assert main([
        "verify-desktop", "--dir", str(tmp_path), "--version", VERSION, "--revision", SHA,
        "--check-files", "--sums-out", str(sums),
    ]) == 0
    lines = sums.read_text().splitlines()
    assert [line.split("  ")[1] for line in lines] == [
        "RetainPDF-Windows-4.2.7-Setup.exe", "RetainPDF-Linux-4.2.7.deb", "RetainPDF-Mac-4.2.7.dmg",
    ]
    assert lines[2].split("  ")[0] == hashlib.sha256(b"macos-package").hexdigest()


def test_verify_desktop_detects_a_tampered_package(tmp_path):
    files = make_desktop_set(tmp_path)
    files["linux"].write_bytes(b"linux-pac0age")  # same size, different bytes
    with pytest.raises(CandidateError, match="sha256"):
        verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=True)
    # 不比对文件时（提升判定只下载 manifest）仍然通过。
    verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=False)


def test_verify_desktop_detects_a_size_mismatch(tmp_path):
    files = make_desktop_set(tmp_path)
    files["windows"].write_bytes(b"x")
    with pytest.raises(CandidateError, match="size"):
        verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=True)


@pytest.mark.parametrize("field,value,message", [
    ("revision", "d" * 40, "revision"),
    ("version", "4.2.6", "version"),
    ("file", "RetainPDF-Mac-4.2.6.dmg", "file"),
    ("sha256", "nothex", "sha256"),
    ("platform", "linux", "platform"),
])
def test_verify_desktop_rejects_identity_mismatches(tmp_path, field, value, message):
    make_desktop_set(tmp_path)
    path = tmp_path / "desktop-package-macos.json"
    manifest = json.loads(path.read_text())
    manifest[field] = value
    path.write_text(json.dumps(manifest))
    with pytest.raises(CandidateError, match=message):
        verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=False)


def test_verify_desktop_requires_all_three_platforms(tmp_path):
    make_desktop_set(tmp_path)
    (tmp_path / "desktop-package-windows.json").unlink()
    assert main(["verify-desktop", "--dir", str(tmp_path), "--version", VERSION, "--revision", SHA]) == 1


def test_verify_desktop_rejects_another_commits_set(tmp_path):
    make_desktop_set(tmp_path, revision="e" * 40)
    with pytest.raises(CandidateError, match="revision"):
        verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=True)


def write_docker(directory: Path, **overrides):
    for target in ("app", "web"):
        data = {
            "target": target,
            "repo": f"retainpdf-{target}",
            "digest": "sha256:" + ("1" if target == "app" else "2") * 64,
            "revision": SHA,
            "version": VERSION,
            "platforms": "linux/amd64,linux/arm64",
        }
        data.update(overrides.get(target, {}))
        (directory / f"{target}.json").write_text(json.dumps(data))


def test_verify_docker_accepts_matching_candidates(tmp_path):
    write_docker(tmp_path)
    candidates = verify_docker(tmp_path, version=VERSION, revision=SHA, platforms="linux/arm64, linux/amd64")
    assert set(candidates) == {"app", "web"}


@pytest.mark.parametrize("override,message", [
    ({"revision": "f" * 40}, "revision"),
    ({"version": "4.2.6"}, "version"),
    ({"repo": "retainpdf-web"}, "repo"),
    ({"target": "web"}, "target"),
    ({"digest": "sha256:xyz"}, "digest"),
    ({"platforms": "linux/amd64"}, "platforms"),
])
def test_verify_docker_rejects_mismatches(tmp_path, override, message):
    write_docker(tmp_path, app=override)
    with pytest.raises(CandidateError, match=message):
        verify_docker(tmp_path, version=VERSION, revision=SHA, platforms="linux/amd64,linux/arm64")


def test_verify_docker_requires_both_images(tmp_path):
    write_docker(tmp_path)
    (tmp_path / "web.json").unlink()
    assert main([
        "verify-docker", "--dir", str(tmp_path), "--version", VERSION, "--revision", SHA,
        "--platforms", "linux/amd64,linux/arm64",
    ]) == 1


def make_extras(directory: Path, platform: str, version=VERSION) -> list[Path]:
    from release_candidate_manifest import expected_desktop_extras

    paths = []
    for name in expected_desktop_extras(platform, version):
        path = directory / name
        path.write_bytes(f"{name}-content".encode())
        paths.append(path)
    return paths


def test_release_requires_auto_update_extras_and_lists_them_in_sums(tmp_path):
    """自动更新的附带文件（latest*.yml、.blockmap、Mac 的 zip）发版时要齐，sha256 也写进 SHA256SUMS。"""
    for platform in ("windows", "linux", "macos"):
        package = tmp_path / expected_desktop_file(platform, VERSION)
        package.write_bytes(f"{platform}-package".encode())
        args = ["record-desktop", "--platform", platform, "--file", str(package),
                "--version", VERSION, "--revision", SHA, "--out-dir", str(tmp_path)]
        for extra in make_extras(tmp_path, platform):
            args += ["--extra", str(extra)]
        assert main(args) == 0
    sums = tmp_path / "SHA256SUMS.txt"
    manifests = verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=True, require_extras=True)
    from release_candidate_manifest import write_sha256sums

    write_sha256sums(manifests, sums)
    text = sums.read_text(encoding="utf-8")
    for name in ("latest.yml", "latest-mac.yml", f"RetainPDF-Mac-{VERSION}.zip", f"RetainPDF-Windows-{VERSION}-Setup.exe.blockmap"):
        assert name in text
    # 附带文件被改过：发版拒绝
    (tmp_path / "latest-mac.yml").write_bytes(b"tampered")
    with pytest.raises(CandidateError, match="latest-mac.yml"):
        verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=True, require_extras=True)


def test_missing_extras_only_fail_when_required(tmp_path):
    make_desktop_set(tmp_path)
    # 预构建时（resolve 阶段）不要求附带文件
    verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=True)
    with pytest.raises(CandidateError, match="extras"):
        verify_desktop(tmp_path, version=VERSION, revision=SHA, check_files=True, require_extras=True)


def test_record_desktop_rejects_unexpected_extras(tmp_path):
    package = tmp_path / expected_desktop_file("linux", VERSION)
    package.write_bytes(b"deb")
    stray = tmp_path / "latest-linux.yml"
    stray.write_bytes(b"x")
    with pytest.raises(CandidateError, match="not one of"):
        record_desktop(platform="linux", file=package, version=VERSION, revision=SHA, extras=[stray])
