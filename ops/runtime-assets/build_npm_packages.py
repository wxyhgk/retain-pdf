"""按 backend/config/runtime_assets.json 生成要发到 npm 的包目录（字体、各平台 Typst），逐个文件核对 sha256。

用法（在仓库根目录）：

    python3 ops/runtime-assets/build_npm_packages.py --out /tmp/retainpdf-npm
    # 然后逐个目录 npm publish --access public（要先在 npm 上建好 @retainpdf 组织、npm login）

- 字体取仓库里的 resources/fonts/；
- Typst 从清单里每个平台的 upstream（Typst 官方 GitHub 发布）下载、解开，只取清单列出的文件；
- 每个文件的 sha256、大小必须和清单一致，不一致就停下：清单是运行时校验的依据，包和清单对不上，用户那边会下载失败。

包里的文件放在包根目录（npm 打包后在 tarball 的 package/ 下），后端下载 tarball 后按清单的 path 取出来。
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import tarfile
import urllib.request
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MANIFEST = REPO / "backend" / "config" / "runtime_assets.json"
FONTS_DIR = REPO / "resources" / "fonts"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _check(path: Path, expected: dict) -> None:
    size = path.stat().st_size
    actual = _sha256(path)
    if actual != expected["sha256"] or size != expected["size"]:
        raise SystemExit(
            f"{path} 和清单对不上：sha256 {actual}（清单 {expected['sha256']}），大小 {size}（清单 {expected['size']}）"
        )


def _package_json(name: str, version: str, description: str, files: list[dict], license_name: str) -> dict:
    return {
        "name": name,
        "version": version,
        "description": description,
        "license": license_name,
        "homepage": "https://github.com/wxyhgk/retain-pdf",
        "repository": {"type": "git", "url": "git+https://github.com/wxyhgk/retain-pdf.git"},
        "files": [entry["path"] for entry in files],
    }


def build_fonts(spec: dict, out: Path) -> Path:
    target = out / spec["package"].split("/")[-1]
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True)
    for entry in spec["files"]:
        source = FONTS_DIR / entry["path"]
        _check(source, entry)
        shutil.copy2(source, target / entry["path"])
    package = _package_json(
        spec["package"],
        spec["package_version"],
        # RetainPDFSerifSC-W*.otf：可变字体切出的细体（修改版，OFL 保留了 Source 这个名字，所以改了名），见 resources/fonts/README.md
        f"Source Han Serif SC 2.003R (Adobe, unmodified), plus RetainPDF Serif SC (static instances of its variable font, "
        f"renamed as the OFL requires) for RetainPDF's on-demand runtime assets.",
        spec["files"],
        "OFL-1.1",
    )
    (target / "package.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target


def _download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=300) as response:  # noqa: S310 - 清单里写死的 GitHub 发布地址
        return response.read()


def _extract_members(archive: bytes, url: str, wanted: set[str]) -> dict[str, bytes]:
    found: dict[str, bytes] = {}
    if url.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            for info in bundle.infolist():
                name = Path(info.filename).name
                if name in wanted and not info.is_dir():
                    found[name] = bundle.read(info)
    else:
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:*") as bundle:
            for member in bundle.getmembers():
                name = Path(member.name).name
                if name in wanted and member.isfile():
                    extracted = bundle.extractfile(member)
                    if extracted is not None:
                        found[name] = extracted.read()
    missing = wanted - set(found)
    if missing:
        raise SystemExit(f"{url} 里没找到 {sorted(missing)}")
    return found


def build_typst(platform: str, spec: dict, version: str, out: Path) -> Path:
    target = out / spec["package"].split("/")[-1]
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True)
    archive = _download(spec["upstream"])
    members = _extract_members(archive, spec["upstream"], {entry["path"] for entry in spec["files"]})
    for entry in spec["files"]:
        path = target / entry["path"]
        path.write_bytes(members[entry["path"]])
        if entry.get("executable"):
            path.chmod(0o755)
        _check(path, entry)
    package = _package_json(
        spec["package"],
        spec["package_version"],
        f"Typst {version} CLI ({platform}, official release binary) for RetainPDF's on-demand runtime assets.",
        spec["files"],
        "Apache-2.0",
    )
    (target / "package.json").write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, required=True, help="生成包目录的位置（每个包一个子目录）")
    parser.add_argument("--only", choices=["fonts", "typst"], help="只生成一类")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = manifest["assets"]
    built: list[Path] = []
    if args.only in (None, "fonts"):
        built.append(build_fonts(assets["fonts"], args.out))
    if args.only in (None, "typst"):
        typst = assets["typst"]
        for platform, spec in typst["platforms"].items():
            built.append(build_typst(platform, spec, typst["version"], args.out))
    print("包目录（逐个进去 npm publish --access public）：")
    for path in built:
        print(f"  {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
