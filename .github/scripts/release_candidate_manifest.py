"""Record and verify the identity of release candidates (desktop packages and Docker images).

预构建产物在「打 tag 时提升」之前必须证明自己就是这个 commit、这个版本构建出来的：

- record-desktop：桌面 build job 打完包后记录 {platform, file, version, revision,
  sha256, size}，作为单独的小 artifact 上传（提升判定时只下载它，不下载安装包）。
- verify-desktop：校验三平台 manifest 齐全、版本 / revision 与本次发布一致、文件名
  符合约定；--check-files 时再逐个比对安装包的大小和 sha256，并写出 SHA256SUMS。
- verify-docker：校验 app / web 两份 candidate identity JSON（merge job 写出）的
  target / repo / revision / version / digest / platforms。

任何不一致都以非零退出：提升路径上它是硬门禁，提升判定（resolve job）里则用它
决定能否提升、不能就回退到完整构建。
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


DESKTOP_PLATFORMS = ("windows", "linux", "macos")
DESKTOP_FILE_PATTERNS = {
    "windows": "RetainPDF-Windows-{version}-Setup.exe",
    "linux": "RetainPDF-Linux-{version}.deb",
    "macos": "RetainPDF-Mac-{version}.dmg",
}
# 自动更新要的附带文件（2026-11-22 起）：electron-updater 读 latest*.yml、按 .blockmap 增量下载；
# Mac 的自动更新下的是 zip（dmg 只给第一次安装）。Linux 的 deb 不支持自动更新，没有附带文件。
# 发版时（verify-desktop --require-extras）这些一个都不能少，大小和 sha256 也要和清单一致。
DESKTOP_EXTRA_PATTERNS = {
    "windows": ("RetainPDF-Windows-{version}-Setup.exe.blockmap", "latest.yml"),
    "linux": (),
    "macos": ("RetainPDF-Mac-{version}.zip", "RetainPDF-Mac-{version}.zip.blockmap", "latest-mac.yml"),
}
DOCKER_TARGETS = {"app": "retainpdf-app", "web": "retainpdf-web"}
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
IMAGE_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
GIT_SHA = re.compile(r"^[0-9a-f]{40}$")
MANIFEST_SCHEMA = 1


class CandidateError(ValueError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def desktop_manifest_name(platform: str) -> str:
    return f"desktop-package-{platform}.json"


def expected_desktop_file(platform: str, version: str) -> str:
    return DESKTOP_FILE_PATTERNS[platform].format(version=version)


def expected_desktop_extras(platform: str, version: str) -> list[str]:
    return [pattern.format(version=version) for pattern in DESKTOP_EXTRA_PATTERNS[platform]]


def _file_record(path: Path) -> dict:
    if not path.is_file() or path.stat().st_size == 0:
        raise CandidateError(f"missing or empty desktop file: {path}")
    return {"file": path.name, "sha256": sha256_file(path), "size": path.stat().st_size}


def record_desktop(
    *, platform: str, file: Path, version: str, revision: str, extras: list[Path] | None = None
) -> dict:
    if platform not in DESKTOP_PLATFORMS:
        raise CandidateError(f"unknown desktop platform {platform!r}")
    if not GIT_SHA.fullmatch(revision):
        raise CandidateError(f"invalid revision {revision!r}")
    if file.name != expected_desktop_file(platform, version):
        raise CandidateError(
            f"{platform} package {file.name!r} does not match expected "
            f"{expected_desktop_file(platform, version)!r}"
        )
    if not file.is_file() or file.stat().st_size == 0:
        raise CandidateError(f"missing or empty desktop package: {file}")
    allowed_extras = set(expected_desktop_extras(platform, version))
    extra_records = []
    for extra in extras or []:
        if extra.name not in allowed_extras:
            raise CandidateError(f"{platform} extra {extra.name!r} is not one of {sorted(allowed_extras)}")
        extra_records.append(_file_record(extra))
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "platform": platform,
        "file": file.name,
        "version": version,
        "revision": revision,
        "sha256": sha256_file(file),
        "size": file.stat().st_size,
    }
    if extra_records:
        manifest["extras"] = sorted(extra_records, key=lambda item: item["file"])
    return manifest


def _load_json(path: Path) -> dict:
    if not path.is_file() or path.stat().st_size == 0:
        raise CandidateError(f"missing candidate manifest: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise CandidateError(f"invalid JSON in {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise CandidateError(f"candidate manifest {path} is not an object")
    return data


def _check_file(directory: Path, record: dict) -> None:
    path = directory / record["file"]
    if not path.is_file():
        raise CandidateError(f"missing desktop file: {path}")
    if path.stat().st_size != record["size"]:
        raise CandidateError(f"{record['file']} size {path.stat().st_size} != manifest {record['size']}")
    actual = sha256_file(path)
    if actual != record["sha256"]:
        raise CandidateError(f"{record['file']} sha256 {actual} != manifest {record['sha256']}")


def verify_desktop(
    directory: Path,
    *,
    version: str,
    revision: str,
    check_files: bool,
    require_extras: bool = False,
) -> list[dict]:
    """Return manifests ordered windows, linux, macos; raise on any mismatch."""
    manifests = []
    for platform in DESKTOP_PLATFORMS:
        manifest = _load_json(directory / desktop_manifest_name(platform))
        expected_file = expected_desktop_file(platform, version)
        problems = []
        if manifest.get("schema") != MANIFEST_SCHEMA:
            problems.append(f"schema={manifest.get('schema')!r}")
        if manifest.get("platform") != platform:
            problems.append(f"platform={manifest.get('platform')!r}")
        if manifest.get("revision") != revision:
            problems.append(f"revision={manifest.get('revision')!r} expected {revision}")
        if manifest.get("version") != version:
            problems.append(f"version={manifest.get('version')!r} expected {version}")
        if manifest.get("file") != expected_file:
            problems.append(f"file={manifest.get('file')!r} expected {expected_file}")
        if not SHA256_HEX.fullmatch(f"{manifest.get('sha256', '')}"):
            problems.append(f"sha256={manifest.get('sha256')!r}")
        if not isinstance(manifest.get("size"), int) or manifest["size"] <= 0:
            problems.append(f"size={manifest.get('size')!r}")
        extras = manifest.get("extras", [])
        if not isinstance(extras, list) or not all(
            isinstance(item, dict) and SHA256_HEX.fullmatch(f"{item.get('sha256', '')}")
            and isinstance(item.get("size"), int) and item["size"] > 0
            for item in extras
        ):
            problems.append(f"extras={extras!r}")
        elif require_extras:
            listed = sorted(item.get("file") for item in extras)
            wanted = sorted(expected_desktop_extras(platform, version))
            if listed != wanted:
                problems.append(f"extras={listed!r} expected {wanted!r}")
        if problems:
            raise CandidateError(f"{platform} desktop manifest mismatch: {'; '.join(problems)}")
        if check_files:
            package = directory / expected_file
            if not package.is_file():
                raise CandidateError(f"missing desktop package: {package}")
            _check_file(directory, {"file": expected_file, "size": manifest["size"], "sha256": manifest["sha256"]})
            for extra in extras:
                _check_file(directory, extra)
        manifests.append(manifest)
    return manifests


def write_sha256sums(manifests: list[dict], path: Path) -> None:
    lines = []
    for manifest in manifests:
        lines.append(f"{manifest['sha256']}  {manifest['file']}\n")
        lines.extend(f"{extra['sha256']}  {extra['file']}\n" for extra in manifest.get("extras", []))
    path.write_text("".join(lines), encoding="utf-8")


def _platform_set(value: str) -> list[str]:
    return sorted(item.strip() for item in f"{value or ''}".split(",") if item.strip())


def verify_docker(
    directory: Path,
    *,
    version: str,
    revision: str,
    platforms: str,
) -> dict[str, dict]:
    expected_platforms = _platform_set(platforms)
    if not expected_platforms:
        raise CandidateError("expected Docker platforms must not be empty")
    candidates = {}
    for target, repo in DOCKER_TARGETS.items():
        manifest = _load_json(directory / f"{target}.json")
        problems = []
        if manifest.get("target") != target:
            problems.append(f"target={manifest.get('target')!r}")
        if manifest.get("repo") != repo:
            problems.append(f"repo={manifest.get('repo')!r} expected {repo}")
        if manifest.get("revision") != revision:
            problems.append(f"revision={manifest.get('revision')!r} expected {revision}")
        if manifest.get("version") != version:
            problems.append(f"version={manifest.get('version')!r} expected {version}")
        if not IMAGE_DIGEST.fullmatch(f"{manifest.get('digest', '')}"):
            problems.append(f"digest={manifest.get('digest')!r}")
        if _platform_set(manifest.get("platforms", "")) != expected_platforms:
            problems.append(
                f"platforms={manifest.get('platforms')!r} expected {','.join(expected_platforms)}"
            )
        if problems:
            raise CandidateError(f"{target} Docker candidate mismatch: {'; '.join(problems)}")
        candidates[target] = manifest
    return candidates


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    record = sub.add_parser("record-desktop")
    record.add_argument("--platform", required=True, choices=DESKTOP_PLATFORMS)
    record.add_argument("--file", required=True, type=Path)
    record.add_argument("--version", required=True)
    record.add_argument("--revision", required=True)
    record.add_argument("--out-dir", required=True, type=Path)
    record.add_argument("--extra", action="append", type=Path, default=[], help="自动更新的附带文件（可多次）")

    desktop = sub.add_parser("verify-desktop")
    desktop.add_argument("--dir", required=True, type=Path)
    desktop.add_argument("--version", required=True)
    desktop.add_argument("--revision", required=True)
    desktop.add_argument("--check-files", action="store_true")
    desktop.add_argument("--sums-out", type=Path)
    desktop.add_argument("--require-extras", action="store_true", help="发版时要求自动更新的附带文件齐全")

    docker = sub.add_parser("verify-docker")
    docker.add_argument("--dir", required=True, type=Path)
    docker.add_argument("--version", required=True)
    docker.add_argument("--revision", required=True)
    docker.add_argument("--platforms", required=True)

    args = parser.parse_args(argv)
    try:
        if args.command == "record-desktop":
            manifest = record_desktop(
                platform=args.platform, file=args.file, version=args.version, revision=args.revision,
                extras=args.extra,
            )
            args.out_dir.mkdir(parents=True, exist_ok=True)
            out = args.out_dir / desktop_manifest_name(args.platform)
            out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            print(out.read_text(encoding="utf-8"))
        elif args.command == "verify-desktop":
            if args.sums_out is not None and not args.check_files:
                parser.error("--sums-out requires --check-files")
            manifests = verify_desktop(
                args.dir, version=args.version, revision=args.revision, check_files=args.check_files,
                require_extras=args.require_extras,
            )
            if args.sums_out is not None:
                write_sha256sums(manifests, args.sums_out)
            for manifest in manifests:
                print(f"{manifest['platform']}: {manifest['file']} sha256={manifest['sha256']}")
        else:
            candidates = verify_docker(
                args.dir, version=args.version, revision=args.revision, platforms=args.platforms
            )
            for target, manifest in candidates.items():
                print(f"{target}: {manifest['repo']}@{manifest['digest']} ({manifest['platforms']})")
    except CandidateError as exc:
        print(f"release candidate check failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
