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
  另加两项（清单 ``features`` 里写着 ``erase``、``tables``，2026-11-28 阅读页只加载原文 PDF）：

  - ``erase: [{rect, fill}]``：渲染源里抹掉、又不在 ``covers`` 下面的原字（去字 PDF 抹掉的英文小标题之类）。
    拿原文页和底图逐行比：原文页这一行的字底图里没了、像素也变了，就记下这一行的框，``fill`` 取底图那块最多的颜色。
    有了它，阅读页拿原文页做底、先画这些框，就不用下载底图；
  - ``tables: [{id, cover, rules, blocks}]``：``rpr-table`` 排进原表框里的表格（``render/output/tables``，正文排完
    以后另一遍）。``cover`` 盖掉原表（框往外放 2pt，原表的线压在框边上；``fill`` 取原文页那块最多的颜色），
    ``rules`` 是新画的表格线（细长的实心矩形 ``{rect, fill}``），``blocks`` 和正文的块一样（``id`` 是
    ``<表格块号>:r<行>c<列>``）。表格那一遍在 :func:`add_reader_layout_tables` 里补进来。
  - 目录原位替换（渲染参数 ``toc_mode = replace``，``render/output/toc_replace``，2026-11-28）在正文排完以后另一遍：
    标题原字的框加进 ``erase``，目录的块加进 ``blocks``（:func:`add_reader_layout_toc`）。

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
from collections import Counter
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
# 译文 PDF 正文用的细体（思源宋体可变字体切出的静态实例，engine_cli.DEFAULT_PDF_FONT_WEIGHT）：阅读页照旧给常规体，
# 只有下载的 PDF 变细（HTML 页浏览器自己画，不会像 PDF 阅读器那样加粗）。版面里字簇的 font 还是细体的 key。
LIGHT_FACE_PREFIX = "RetainPDFSerifSC-W"
REGULAR_FACE = ("SourceHanSerifSC-Regular", "SourceHanSerifSC-Regular.otf")
# 页文件里有 erase、tables 两项（阅读页据此不下载底图、画表格）
FEATURES = ["erase", "tables"]
# 要抹掉的原字：行框往外放这么多（pt），盖住字的边
ERASE_PAD_PT = 0.6
# 比像素、取底色时的放大倍数（72 dpi 的几倍）
SAMPLE_SCALE = 2.0
# 一个像素任一通道差过这么多算变了；变了的像素不到这个比例算没变（隐藏的文字层抹掉了，页面看着一样）
PIXEL_DIFF_LEVEL = 40
PIXEL_DIFF_RATIO = 0.01
# 一行的框有这么多落在 covers 里，就交给 covers 盖
COVERED_RATIO = 0.8
# 盖原表：框往外放这么多（和 render/output/tables/overlay.py 擦线的 RULE_MARGIN_PT 一样）
TABLE_COVER_MARGIN_PT = 2.0


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


def _page_blocks(page: dict):
    yield from page.get("blocks") or []
    for table in page.get("tables") or []:
        yield from table.get("blocks") or []


def _layout_items(layout: dict):
    for page in layout.get("pages") or []:
        for block in _page_blocks(page):
            for line in block.get("lines") or []:
                yield from line.get("items") or []


def _fill_of(pixmap) -> list[float]:
    """一块像素里最多的颜色（按每通道 16 级归堆，取那一堆的平均），0–1。底色就是字和线以外最多的那种。"""
    samples = pixmap.samples
    n = pixmap.n
    bins: Counter = Counter()
    sums: dict[tuple[int, int, int], list[int]] = {}
    for offset in range(0, len(samples) - n + 1, n):
        r, g, b = samples[offset], samples[offset + 1], samples[offset + 2]
        key = (r >> 4, g >> 4, b >> 4)
        bins[key] += 1
        total = sums.setdefault(key, [0, 0, 0])
        total[0] += r
        total[1] += g
        total[2] += b
    if not bins:
        return [1.0, 1.0, 1.0]
    key, count = bins.most_common(1)[0]
    return [round(value / count / 255, 3) for value in sums[key]]


def _pixmap(page, rect):
    import fitz

    return page.get_pixmap(matrix=fitz.Matrix(SAMPLE_SCALE, SAMPLE_SCALE), clip=rect, colorspace=fitz.csRGB, alpha=False)


def _pixels_changed(before, after) -> bool:
    if (before.width, before.height) != (after.width, after.height):
        return True
    a, b, n = before.samples, after.samples, before.n
    changed = 0
    for offset in range(0, len(a) - n + 1, n):
        if (
            abs(a[offset] - b[offset]) > PIXEL_DIFF_LEVEL
            or abs(a[offset + 1] - b[offset + 1]) > PIXEL_DIFF_LEVEL
            or abs(a[offset + 2] - b[offset + 2]) > PIXEL_DIFF_LEVEL
        ):
            changed += 1
    return changed > max(2, before.width * before.height * PIXEL_DIFF_RATIO)


def _squash(text: str) -> str:
    return "".join(str(text or "").split())


def _covered(rect, covers: list) -> bool:
    import fitz

    area = rect.width * rect.height
    if area <= 0:
        return True
    inside = 0.0
    for cover in covers:
        overlap = fitz.Rect(rect) & fitz.Rect(cover)
        inside += max(0.0, overlap.width) * max(0.0, overlap.height)
    return inside >= area * COVERED_RATIO


def page_erase(original_page, background_page, covers: list) -> list[dict]:
    """原文页上、底图里抹掉了、又不在 covers 下面的原字：一行一个 ``{rect, fill}``。

    原文页的每一行字：在 covers 下面的跳过；底图同一个框里还有这行字的跳过（公式盖回原件的块、没去的字）；
    比像素没变的跳过（隐藏的文字层）。剩下的记下行框（往外放一点），底色取底图那块最多的颜色。"""
    import fitz

    cover_rects = [cover.get("rect") for cover in covers if isinstance(cover, dict) and cover.get("rect")]
    erase: list[dict] = []
    for block in original_page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            text = _squash("".join(span.get("text", "") for span in line.get("spans", [])))
            if not text:
                continue
            rect = fitz.Rect(line["bbox"]) + (-ERASE_PAD_PT, -ERASE_PAD_PT, ERASE_PAD_PT, ERASE_PAD_PT)
            rect &= original_page.rect
            if rect.is_empty or _covered(rect, cover_rects):
                continue
            if text in _squash(background_page.get_text("text", clip=rect)):
                continue
            after = _pixmap(background_page, rect)
            if not _pixels_changed(_pixmap(original_page, rect), after):
                continue
            erase.append({"rect": [round(value, 2) for value in rect], "fill": _fill_of(after)})
    return erase


def _erase_by_page(
    original_pdf_path: Path | None, background: dict[str, object] | None, target: Path, layout: dict
) -> dict[int, list[dict]]:
    """每页要抹掉的原字（见 :func:`page_erase`）。没有底图（渲染源就是原件，没抹字）时都是空的。"""
    if background is None or original_pdf_path is None or not Path(original_pdf_path).is_file():
        return {}
    import fitz

    position = {int(page): offset for offset, page in enumerate(background.get("pages") or [])}
    result: dict[int, list[dict]] = {}
    with fitz.open(original_pdf_path) as original, fitz.open(target / BACKGROUND_FILE) as stripped:
        for page in layout.get("pages") or []:
            index = int(page["index"])
            if index not in position or index >= len(original) or position[index] >= len(stripped):
                continue
            result[index] = page_erase(original[index], stripped[position[index]], page.get("covers") or [])
    return result


def _clear_dir(directory: Path, keep: set[str]) -> None:
    if directory.is_dir():
        for stale in directory.iterdir():
            if stale.is_file() and stale.name not in keep:
                stale.unlink(missing_ok=True)


def _save_math(target: Path, layout: dict, layout_dir: Path, *, clear: bool = True) -> int:
    """版面里公式指着的 SVG（引擎写在它的输出目录 math/ 下）拷过来。``clear``：删掉这次没用到的旧文件。"""
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
    if clear:
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
        postscript = str(face.get("postscript") or "")
        weight = int(face.get("weight") or 400)
        if postscript.startswith(LIGHT_FACE_PREFIX) and postscript[len(LIGHT_FACE_PREFIX):].isdigit():
            postscript, file_name = REGULAR_FACE
            weight = 400
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
                "postscript": postscript,
                "family": str(face.get("family") or ""),
                "weight": weight,
                "mono": bool(face.get("mono")),
                "file": f"{FONTS_DIR}/{name}",
                # 切子集用的那份字体文件名：表格那一遍补字时要重切（后端不读）
                "source_file": file_name,
                "etag": hashlib.sha256(data).hexdigest()[:16],
                "chars": len(chars[key]),
                "bytes": len(data),
            }
        )
    _clear_dir(target / FONTS_DIR, names)
    return saved, ("font_file_missing:" + ",".join(missing)) if missing else ""


def _write_page(target: Path, page: dict) -> tuple[dict[str, object], int, int]:
    """存一页，返回 (清单里这一页, 原始字节数, 压完字节数)。"""
    index = int(page["index"])
    data = _page_bytes(page)
    # mtime=0：同样的版面压出同样的字节
    packed = gzip.compress(data, compresslevel=6, mtime=0)
    name = page_file_name(index)
    atomic_write_bytes(target / name, packed, durable=False)
    entry = {
        "index": index,
        "width": page.get("width"),
        "height": page.get("height"),
        "etag": hashlib.sha256(data).hexdigest()[:16],
        "blocks": len(page.get("blocks") or []),
        "tables": len(page.get("tables") or []),
        "file": name,
    }
    return entry, len(data), len(packed)


def _read_page(target: Path, index: int) -> dict | None:
    path = target / page_file_name(index)
    if not path.is_file():
        return None
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


def _write_manifest(target: Path, manifest: dict) -> None:
    # 清单最后写：读的人先读清单，清单里的页都已经在了
    atomic_write_bytes(
        target / READER_LAYOUT_MANIFEST,
        json.dumps(manifest, ensure_ascii=False, indent=1).encode("utf-8"),
        durable=False,
    )


def _manifest_fonts(fonts: list[dict]) -> list[dict]:
    return [
        {key: face[key] for key in ("key", "postscript", "family", "weight", "mono", "file", "etag", "source_file") if key in face}
        for face in fonts
    ]


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
    （``--font-path`` 加引擎自带的后备字体目录），按版面里的文件名找字体切子集。

    每页另加 ``erase``（要抹掉的原字）和 ``tables``（先是空的，表格那一遍 :func:`add_reader_layout_tables` 补）。"""
    layout = json.loads(Path(layout_path).read_text(encoding="utf-8"))
    if not isinstance(layout, dict) or layout.get("schema") != LAYOUT_SCHEMA:
        raise ValueError(f"not a {LAYOUT_SCHEMA} file: {layout_path}")
    target = reader_layout_dir(output_pdf_path)
    (target / PAGES_DIR).mkdir(parents=True, exist_ok=True)
    ordered = sorted(int(page["index"]) for page in layout.get("pages") or [])
    background = _save_background(
        target=target,
        source_pdf_path=source_pdf_path,
        original_pdf_path=original_pdf_path,
        page_indices=ordered,
        restored_regions=list(restored_regions or []),
    )
    erase = _erase_by_page(original_pdf_path, background, target, layout)
    pages: list[dict[str, object]] = []
    written: set[str] = set()
    raw_bytes = 0
    stored_bytes = 0
    for page in layout.get("pages") or []:
        page = {**page, "erase": erase.get(int(page["index"]), []), "tables": []}
        entry, raw, stored = _write_page(target, page)
        pages.append(entry)
        written.add(Path(str(entry["file"])).name)
        raw_bytes += raw
        stored_bytes += stored
    for stale in (target / PAGES_DIR).glob("*.json.gz"):
        if stale.name not in written:
            stale.unlink(missing_ok=True)
    math_count = _save_math(target, layout, Path(layout_path).parent)
    fonts, fonts_skipped = _save_fonts(target, layout, list(font_dirs or []))
    manifest = {
        "schema": READER_LAYOUT_SCHEMA,
        "layout_schema": LAYOUT_SCHEMA,
        "engine_version": engine_version,
        "engine_commit": engine_commit,
        "output_pdf": Path(output_pdf_path).name,
        "features": list(FEATURES),
        "pages": sorted(pages, key=lambda page: int(page["index"])),
        "background": background,
        "fonts": _manifest_fonts(fonts),
    }
    _write_manifest(target, manifest)
    background_bytes = (target / BACKGROUND_FILE).stat().st_size if background else 0
    return {
        "pages": len(pages),
        "raw_bytes": raw_bytes,
        "stored_bytes": stored_bytes,
        "background_bytes": background_bytes,
        "erase": sum(len(rects) for rects in erase.values()),
        "math": math_count,
        "fonts": [{key: face[key] for key in ("key", "chars", "bytes")} for face in fonts],
        "fonts_skipped": fonts_skipped,
    }


def add_reader_layout_tables(
    *,
    output_pdf_path: Path,
    table_layout_path: Path,
    placements: list[dict],
    original_pdf_path: Path | None,
    font_dirs: list[Path] | None = None,
) -> dict[str, object]:
    """把 ``rpr-table`` 排进去的表格补进版面（表格那一遍在正文排完以后，``render/output/tables/overlay.py``）。

    ``table_layout_path``：``rpr-table`` 写的 layout.json，一张表一页；``placements``：叠进译文 PDF 的那几张表，
    ``{engine_page, page_index, id, rect}``（引擎那一页的页号、原文页号、表格块号、原表的框）。没有版面
    （这次不是 rpr_fit 排的）就跳过。表格用到的字和字体并进字体子集重切一遍，公式 SVG 拷过来。"""
    target = reader_layout_dir(output_pdf_path)
    manifest_path = target / READER_LAYOUT_MANIFEST
    if not manifest_path.is_file():
        return {"skipped": "no_reader_layout"}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != READER_LAYOUT_SCHEMA:
        return {"skipped": "no_reader_layout"}
    table_layout = json.loads(Path(table_layout_path).read_text(encoding="utf-8"))
    engine_pages = {offset: page for offset, page in enumerate(table_layout.get("pages") or [])}
    import fitz

    by_page: dict[int, list[dict]] = {}
    sizes: dict[int, tuple[float, float]] = {}
    original = fitz.open(original_pdf_path) if original_pdf_path is not None and Path(original_pdf_path).is_file() else None
    try:
        for placement in placements:
            engine_page = engine_pages.get(int(placement["engine_page"]))
            if engine_page is None:
                continue
            index = int(placement["page_index"])
            rect = fitz.Rect(placement["rect"]) + (-TABLE_COVER_MARGIN_PT, -TABLE_COVER_MARGIN_PT, TABLE_COVER_MARGIN_PT, TABLE_COVER_MARGIN_PT)
            fill = [1.0, 1.0, 1.0]
            if original is not None and index < len(original):
                rect &= original[index].rect
                fill = _fill_of(_pixmap(original[index], rect))
            by_page.setdefault(index, []).append(
                {
                    "id": str(placement.get("id") or ""),
                    "cover": {"rect": [round(value, 2) for value in rect], "fill": fill},
                    "rules": [
                        {"rect": cover.get("rect"), "fill": cover.get("fill")}
                        for cover in engine_page.get("covers") or []
                    ],
                    "blocks": list(engine_page.get("blocks") or []),
                }
            )
            sizes[index] = (engine_page.get("width"), engine_page.get("height"))
    finally:
        if original is not None:
            original.close()
    if not by_page:
        return {"tables": 0}
    entries = {int(entry["index"]): entry for entry in manifest.get("pages") or []}
    for index, tables in by_page.items():
        page = _read_page(target, index) if index in entries else None
        if page is None:
            # 只有表格、没有正文版面的页：另起一页
            width, height = sizes[index]
            page = {"index": index, "width": width, "height": height, "covers": [], "blocks": [], "erase": []}
        page["tables"] = tables
        entries[index], _, _ = _write_page(target, page)
    _save_math(target, table_layout, Path(table_layout_path).parent, clear=False)
    # 字体子集按全书（正文加表格）用到的字重切：表格可能用到正文没有的字、粗体
    fonts, fonts_skipped = _refresh_fonts(target, manifest, entries, table_layout.get("fonts") or [], font_dirs)
    return {
        "tables": sum(len(tables) for tables in by_page.values()),
        "pages": sorted(by_page),
        "fonts": [{key: face[key] for key in ("key", "chars", "bytes")} for face in fonts],
        "fonts_skipped": fonts_skipped,
    }


def _refresh_fonts(
    target: Path, manifest: dict, entries: dict[int, dict], extra_faces: list, font_dirs, lead_faces: list | None = None
) -> tuple[list[dict], str]:
    """后补进版面的字（表格、目录）并进字体子集，按全书用到的字重切一遍，连同页清单写回清单。
    ``lead_faces`` 排在最前面（主字体：清单里还没有正文的常规体时，目录那一遍补上）。"""
    faces: dict[str, dict] = {}
    for face in lead_faces or []:
        faces[str(face.get("key") or "")] = face
    for face in manifest.get("fonts") or []:
        if face.get("source_file"):
            faces[str(face["key"])] = {**face, "file": face["source_file"]}
    for face in extra_faces:
        faces.setdefault(str(face.get("key") or ""), face)
    whole = {
        "fonts": list(faces.values()),
        "pages": [page for page in (_read_page(target, index) for index in sorted(entries)) if page is not None],
    }
    fonts, fonts_skipped = _save_fonts(target, whole, list(font_dirs or []))
    manifest["pages"] = [entries[index] for index in sorted(entries)]
    manifest["fonts"] = _manifest_fonts(fonts)
    _write_manifest(target, manifest)
    return fonts, fonts_skipped


def _regular_face(faces: list, font_file: Path | None) -> dict | None:
    """正文常规体在清单里的那一项（细体静态实例或思源宋体常规体）。清单里没有（这几页引擎只画了粗体标题）时
    按画目录用的字体文件造一项，和引擎写的一样（key 是 PostScript 名）。"""
    for face in faces:
        names = (str(face.get("key") or ""), str(face.get("postscript") or ""), str(face.get("source_file") or face.get("file") or ""))
        if any(name.startswith(LIGHT_FACE_PREFIX) or name.startswith(REGULAR_FACE[0]) for name in names) and not face.get("mono"):
            return face
    if font_file is None or not Path(font_file).is_file():
        return None
    try:
        from fontTools.ttLib import TTFont

        font = TTFont(str(font_file), lazy=True)
        postscript = str(font["name"].getDebugName(6) or Path(font_file).stem)
        family = str(font["name"].getDebugName(1) or "")
        weight = int(font["OS/2"].usWeightClass or 400)
    except Exception:  # noqa: BLE001 - 没装 fontTools：字体子集反正切不了
        return None
    return {"key": postscript, "postscript": postscript, "family": family, "weight": weight, "mono": False, "file": Path(font_file).name}


def add_reader_layout_toc(
    *,
    output_pdf_path: Path,
    placements: list[dict],
    original_pdf_path: Path | None,
    font_dirs: list[Path] | None = None,
    font_file: Path | None = None,
) -> dict[str, object]:
    """目录原位替换（``render/output/toc_replace``，正文排完以后那一遍）补进版面：每页 ``{page_index, blocks, erase}``。

    ``erase`` 是标题原字的框（阅读页拿原文页做底，先盖掉）：``fill`` 是 None 的按原文页那块最多的颜色取，扫描件给的就是
    盖字的底色。``blocks`` 和正文的块一样，字簇的 ``font`` 填正文常规体的 key（字体子集按它收字；清单里还没有常规体就按
    ``font_file``——画目录 PDF 用的那份字体——补一项排在最前面）。没有版面就跳过。"""
    target = reader_layout_dir(output_pdf_path)
    manifest_path = target / READER_LAYOUT_MANIFEST
    if not manifest_path.is_file():
        return {"skipped": "no_reader_layout"}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema") != READER_LAYOUT_SCHEMA:
        return {"skipped": "no_reader_layout"}
    import fitz

    regular = _regular_face(manifest.get("fonts") or [], font_file)
    main_key = str(regular.get("key") or "") if regular else ""
    lead = [regular] if regular and not any(face.get("key") == main_key for face in manifest.get("fonts") or []) else []
    entries = {int(entry["index"]): entry for entry in manifest.get("pages") or []}
    original = fitz.open(original_pdf_path) if original_pdf_path is not None and Path(original_pdf_path).is_file() else None
    written_blocks = 0
    try:
        for placement in placements:
            index = int(placement["page_index"])
            page = _read_page(target, index) if index in entries else None
            source_page = original[index] if original is not None and index < len(original) else None
            if page is None:
                if source_page is None:
                    continue
                page = {"index": index, "width": round(source_page.rect.width, 3), "height": round(source_page.rect.height, 3),
                        "covers": [], "blocks": [], "erase": [], "tables": []}
            erase = list(page.get("erase") or [])
            for paint in placement.get("erase") or []:
                rect = fitz.Rect(paint["rect"])
                fill = paint.get("fill")
                if fill is None:
                    fill = _fill_of(_pixmap(source_page, rect & source_page.rect)) if source_page is not None else [1.0, 1.0, 1.0]
                erase.append({"rect": [round(value, 2) for value in rect], "fill": list(fill)})
            ids = {str(block.get("id")) for block in placement.get("blocks") or []}
            blocks = [block for block in page.get("blocks") or [] if str(block.get("id")) not in ids]
            for block in placement.get("blocks") or []:
                if main_key:
                    block = {**block, "lines": [{**line, "items": [{**item, "font": main_key} for item in line["items"]]}
                                                for line in block.get("lines") or []]}
                blocks.append(block)
                written_blocks += 1
            page.update({"erase": erase, "blocks": blocks})
            page.setdefault("tables", [])
            entries[index], _, _ = _write_page(target, page)
    finally:
        if original is not None:
            original.close()
    fonts, fonts_skipped = _refresh_fonts(target, manifest, entries, [], font_dirs, lead)
    return {
        "pages": sorted(int(placement["page_index"]) for placement in placements),
        "blocks": written_blocks,
        "fonts": [{key: face[key] for key in ("key", "chars", "bytes")} for face in fonts],
        "fonts_skipped": fonts_skipped,
    }


def clear_reader_layout(output_pdf_path: object) -> None:
    """这次没走 rpr_fit：删掉上一次的版面（对不上这次的 PDF）。没给译文 PDF 路径就什么都不做。"""
    if not isinstance(output_pdf_path, (str, os.PathLike)) or not str(output_pdf_path):
        return
    shutil.rmtree(reader_layout_dir(Path(output_pdf_path)), ignore_errors=True)


__all__ = [
    "FEATURES",
    "READER_LAYOUT_DIR",
    "READER_LAYOUT_MANIFEST",
    "READER_LAYOUT_SCHEMA",
    "add_reader_layout_tables",
    "add_reader_layout_toc",
    "clear_reader_layout",
    "page_erase",
    "page_file_name",
    "reader_layout_dir",
    "save_reader_layout",
]
