"""阅读页「HTML 页」照排版结果画用的版面（2026-11-28）。

rpr_fit 引擎每次排完写一份 ``layout.json``（``rpr_layout_v1``，见引擎 ``src/output/pdf/layout.js``），译文 PDF 的
叠加层就是只从这份文件画出来的。阅读页拿原文页做底、照它把字摆到同样的位置，画出来就和译文 PDF 一样。

引擎目录（``rendered/typst/rpr-fit-engine/``）每次渲染清空重建、成功以后被清理掉，所以排完把版面按页存一份到
译文 PDF 旁边的 ``reader-layout/``：

- ``manifest.json``：``schema``、引擎版本和提交号、每页 ``{index, width, height, etag, blocks, file}``；
- ``background.pdf``：底图，就是译文 PDF 的底（去掉原字的渲染源），只含有版面的那些页、按页号从小到大排；
  公式查不过、改回原文的块照译文 PDF 一样盖回原件。渲染源就是上传的原件（扫描件、没去字）时不另存，
  清单里 ``background`` 是 null，阅读页用原文页做底；
- ``fonts/<key>.woff2``：画字用的字体，和引擎画 PDF 用的同一份文件，只留这本书用到的字、转 woff2
  （思源宋体整份 24 MB；有的后备字体 .otf 浏览器装不上）。``key`` 就是版面里字簇的 ``font``（引擎写的）。
  要装 fontTools（pipeline 的 extra ``reader-fonts``），没装时清单的 ``fonts`` 是空的；
- ``math/<hash>.svg``：公式的 MathJax SVG，版面里公式那一项的 ``svg`` 指着它（引擎写的）；
- ``pages/<页号>.json.gz``：一页（``{index, width, height, covers, blocks}``，和 layout.json 里的一页一样），
  紧凑 JSON 再 gzip（481 页的书整份 layout 二十几 MB，压完几 MB）。``etag`` 是这页 JSON 的 sha256 前 16 位。

页号 ``index`` 是原文页号（从 0 起）；没有译文条目的页（整页图、不翻的参考文献）不在里面。没走 rpr_fit（选了
Typst、回退 Typst）时删掉这个目录，免得留着上一次的版面对不上这次的 PDF。后端经 ``StoredFile::ReaderLayoutDir``
读它（``/jobs/:id/reader/layout``）。

存不成只记一笔：版面是给阅读页的附带产物，不连累译文 PDF。
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import shutil
from pathlib import Path

from retainpdf_base.io import atomic_write_bytes

READER_LAYOUT_DIR = "reader-layout"
READER_LAYOUT_MANIFEST = "manifest.json"
READER_LAYOUT_SCHEMA = "reader_layout_v1"
LAYOUT_SCHEMA = "rpr_layout_v1"
PAGES_DIR = "pages"
BACKGROUND_FILE = "background.pdf"
FONTS_DIR = "fonts"
MATH_DIR = "math"
_KEY_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")


def reader_layout_dir(output_pdf_path: Path) -> Path:
    return Path(output_pdf_path).parent / READER_LAYOUT_DIR


def page_file_name(index: int) -> str:
    return f"{PAGES_DIR}/{int(index):05d}.json.gz"


def _page_bytes(page: dict) -> bytes:
    return json.dumps(page, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _same_file(left: Path, right: Path | None) -> bool:
    if right is None or not Path(right).is_file():
        return False
    try:
        return Path(left).resolve() == Path(right).resolve() or Path(left).samefile(right)
    except OSError:
        return False


def _save_background(
    *,
    target: Path,
    source_pdf_path: Path | None,
    original_pdf_path: Path | None,
    page_indices: list[int],
    restored_regions: list[tuple[int, list[float]]],
) -> dict[str, object] | None:
    """底图：渲染源里有版面的那些页。渲染源就是原件时不存（返回 None，阅读页用原文页）。"""
    background = target / BACKGROUND_FILE
    if source_pdf_path is None or not Path(source_pdf_path).is_file() or _same_file(source_pdf_path, original_pdf_path):
        background.unlink(missing_ok=True)
        return None
    from retainpdf_pipeline.render.document.pikepdf_pages import extract_page_indices_with_pikepdf
    from retainpdf_pipeline.render.output.rpr_fit import formula_check

    extract_page_indices_with_pikepdf(
        source_pdf_path=Path(source_pdf_path), output_pdf_path=background, page_indices=page_indices
    )
    position = {page: offset for offset, page in enumerate(page_indices)}
    regions = [(position[page], page, bbox) for page, bbox in restored_regions if page in position]
    if regions and original_pdf_path is not None and Path(original_pdf_path).is_file():
        formula_check.restore_original_regions(background, Path(original_pdf_path), regions)
    return {"file": BACKGROUND_FILE, "pages": list(page_indices)}


def _layout_items(layout: dict):
    for page in layout.get("pages") or []:
        for block in page.get("blocks") or []:
            for line in block.get("lines") or []:
                yield from line.get("items") or []


def _clear_dir(directory: Path, keep: set[str]) -> None:
    if directory.is_dir():
        for stale in directory.iterdir():
            if stale.is_file() and stale.name not in keep:
                stale.unlink(missing_ok=True)


def _save_math(target: Path, layout: dict, layout_dir: Path) -> int:
    """版面里公式指着的 SVG（引擎写在它的输出目录 math/ 下）拷过来。"""
    names: set[str] = set()
    for item in _layout_items(layout):
        svg = str(item.get("svg") or "")
        name = svg.removeprefix(f"{MATH_DIR}/")
        if not svg.startswith(f"{MATH_DIR}/") or "/" in name or not name.endswith(".svg"):
            continue
        source = layout_dir / MATH_DIR / name
        if source.is_file():
            atomic_write_bytes(target / MATH_DIR / name, source.read_bytes(), durable=False)
            names.add(name)
    _clear_dir(target / MATH_DIR, names)
    return len(names)


def _find_font_file(name: str, font_dirs: list[Path]) -> Path | None:
    """和引擎（src/output/pdf/fonts.js）一样在这些目录里（含子目录）按文件名找。"""
    for directory in font_dirs:
        directory = Path(directory)
        if (directory / name).is_file():
            return directory / name
        if directory.is_dir():
            for found in sorted(directory.rglob(name)):
                if found.is_file():
                    return found
    return None


def _subset_woff2(font_path: Path, text: str) -> bytes:
    from io import BytesIO

    from fontTools import subset
    from fontTools.ttLib import TTFont

    options = subset.Options()
    options.flavor = "woff2"
    # 浏览器自己整形：留下全部 OpenType 特性（locl 的中文字形、连字……），和引擎画 PDF 时一样
    options.layout_features = ["*"]
    options.notdef_outline = True
    options.desubroutinize = True
    font = TTFont(str(font_path), recalcBBoxes=False, recalcTimestamp=False)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.flavor = "woff2"
    out = BytesIO()
    font.save(out)
    return out.getvalue()


def _save_fonts(target: Path, layout: dict, font_dirs: list[Path]) -> tuple[list[dict], str]:
    """版面用到的字体按这本书用到的字切子集、转 woff2。返回 (清单里的 fonts, 没切的原因)。"""
    faces = [face for face in layout.get("fonts") or [] if isinstance(face, dict)]
    if not faces:
        _clear_dir(target / FONTS_DIR, set())
        return [], "no_fonts_in_layout"
    try:
        import fontTools.subset  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        _clear_dir(target / FONTS_DIR, set())
        return [], "fonttools_missing"
    chars: dict[str, set[str]] = {}
    for item in _layout_items(layout):
        if isinstance(item.get("t"), str) and item.get("font"):
            chars.setdefault(str(item["font"]), set()).update(item["t"])
    saved: list[dict] = []
    names: set[str] = set()
    missing: list[str] = []
    for face in faces:
        key = str(face.get("key") or "")
        file_name = Path(str(face.get("file") or "")).name
        if not key or not set(key) <= _KEY_CHARS or not file_name or key not in chars:
            continue
        source = _find_font_file(file_name, font_dirs)
        if source is None:
            missing.append(file_name)
            continue
        data = _subset_woff2(source, "".join(sorted(chars[key])))
        name = f"{key}.woff2"
        atomic_write_bytes(target / FONTS_DIR / name, data, durable=False)
        names.add(name)
        saved.append(
            {
                "key": key,
                "postscript": str(face.get("postscript") or ""),
                "family": str(face.get("family") or ""),
                "weight": int(face.get("weight") or 400),
                "mono": bool(face.get("mono")),
                "file": f"{FONTS_DIR}/{name}",
                "etag": hashlib.sha256(data).hexdigest()[:16],
                "chars": len(chars[key]),
                "bytes": len(data),
            }
        )
    _clear_dir(target / FONTS_DIR, names)
    return saved, ("font_file_missing:" + ",".join(missing)) if missing else ""


def save_reader_layout(
    *,
    layout_path: Path,
    output_pdf_path: Path,
    engine_version: str,
    engine_commit: str,
    source_pdf_path: Path | None = None,
    original_pdf_path: Path | None = None,
    restored_regions: list[tuple[int, list[float]]] | None = None,
    font_dirs: list[Path] | None = None,
) -> dict[str, object]:
    """把引擎这次写的 layout.json 按页存到译文 PDF 旁边，连同底图。返回写进渲染诊断的几项。

    ``source_pdf_path``：这次的渲染源（译文 PDF 的底）；``original_pdf_path``：上传的原件；
    ``restored_regions``：公式查不过、盖回原件的块 ``(原文页号, 框)``；``font_dirs``：引擎找字体的目录
    （``--font-path`` 加引擎自带的后备字体目录），按版面里的文件名找字体切子集。"""
    layout = json.loads(Path(layout_path).read_text(encoding="utf-8"))
    if not isinstance(layout, dict) or layout.get("schema") != LAYOUT_SCHEMA:
        raise ValueError(f"not a {LAYOUT_SCHEMA} file: {layout_path}")
    target = reader_layout_dir(output_pdf_path)
    (target / PAGES_DIR).mkdir(parents=True, exist_ok=True)
    pages: list[dict[str, object]] = []
    written: set[str] = set()
    raw_bytes = 0
    stored_bytes = 0
    for page in layout.get("pages") or []:
        index = int(page["index"])
        data = _page_bytes(page)
        # mtime=0：同样的版面压出同样的字节
        packed = gzip.compress(data, compresslevel=6, mtime=0)
        name = page_file_name(index)
        atomic_write_bytes(target / name, packed, durable=False)
        written.add(Path(name).name)
        raw_bytes += len(data)
        stored_bytes += len(packed)
        pages.append(
            {
                "index": index,
                "width": page.get("width"),
                "height": page.get("height"),
                "etag": hashlib.sha256(data).hexdigest()[:16],
                "blocks": len(page.get("blocks") or []),
                "file": name,
            }
        )
    for stale in (target / PAGES_DIR).glob("*.json.gz"):
        if stale.name not in written:
            stale.unlink(missing_ok=True)
    ordered = sorted(int(page["index"]) for page in pages)
    background = _save_background(
        target=target,
        source_pdf_path=source_pdf_path,
        original_pdf_path=original_pdf_path,
        page_indices=ordered,
        restored_regions=list(restored_regions or []),
    )
    math_count = _save_math(target, layout, Path(layout_path).parent)
    fonts, fonts_skipped = _save_fonts(target, layout, list(font_dirs or []))
    manifest = {
        "schema": READER_LAYOUT_SCHEMA,
        "layout_schema": LAYOUT_SCHEMA,
        "engine_version": engine_version,
        "engine_commit": engine_commit,
        "output_pdf": Path(output_pdf_path).name,
        "pages": sorted(pages, key=lambda page: int(page["index"])),
        "background": background,
        "fonts": [{key: face[key] for key in ("key", "postscript", "family", "weight", "mono", "file", "etag")} for face in fonts],
    }
    # 清单最后写：读的人先读清单，清单里的页都已经在了
    atomic_write_bytes(
        target / READER_LAYOUT_MANIFEST,
        json.dumps(manifest, ensure_ascii=False, indent=1).encode("utf-8"),
        durable=False,
    )
    background_bytes = (target / BACKGROUND_FILE).stat().st_size if background else 0
    return {
        "pages": len(pages),
        "raw_bytes": raw_bytes,
        "stored_bytes": stored_bytes,
        "background_bytes": background_bytes,
        "math": math_count,
        "fonts": [{key: face[key] for key in ("key", "chars", "bytes")} for face in fonts],
        "fonts_skipped": fonts_skipped,
    }


def clear_reader_layout(output_pdf_path: object) -> None:
    """这次没走 rpr_fit：删掉上一次的版面（对不上这次的 PDF）。没给译文 PDF 路径就什么都不做。"""
    if not isinstance(output_pdf_path, (str, os.PathLike)) or not str(output_pdf_path):
        return
    shutil.rmtree(reader_layout_dir(Path(output_pdf_path)), ignore_errors=True)


__all__ = [
    "READER_LAYOUT_DIR",
    "READER_LAYOUT_MANIFEST",
    "READER_LAYOUT_SCHEMA",
    "clear_reader_layout",
    "page_file_name",
    "reader_layout_dir",
    "save_reader_layout",
]
