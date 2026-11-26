"""扫描件的行间公式编号：截图用 CPU 上的小 OCR 模型认（来源 `ocr_crop`，2026-11-26，方案见
`docs/ops/planning/ocr-normalization/20261126-扫描件公式编号小模型.md`）。

扫描件没有文字层，`pdf_text_layer` 那一步取不到字；GLM-OCR 又多半不给编号。这一步紧跟文字层兜底（`pdf_geometry` 里，
坐标已经是 PDF 的点），只做「页上一个字都取不出来、页面上又有东西」的页，只做前三步都没配上编号的公式：

1. 每页只渲染一次：按页宽约 2000 像素、灰度（不按固定 dpi：开本小的书按 110 dpi 渲染，字太小、检测不到）。
2. 公式框右边、同一行的范围截一条窄图（上下各放宽公式高度的 15%、至少 4 像素；横向从公式右边缘 +4 像素到页宽的 97%），
   只做文字检测，取离公式最近的那个字框（最左边的）。
3. 这个字框四边各扩 6 像素，从整页图上切出来，只做文字识别；整段文字要像编号（`(1.2)`、`(1.3a)`、`(A.1)`、`(5-37)`，
   全角括号也认）才收。
4. 右边一个字框都没有时，同样的办法看公式左边（离公式最近的是最右边那个）。

宁可不配也不配错：离公式最近的字框和别的字挨着（编号后面还有字、是一行正文）不收；落在别的块里、和公式之间隔着别的块、
跨栏的不收（和文字层兜底同一套规则，`formula_numbers.number_position_blocked`）；两个公式认到同一个字框都不收。
点认丢了的（`(57)`、`(5 20)`）交给 `formula_numbers.repair_formula_number_separators` 按前后编号补，补不上的去掉。

模型：rapidocr（Apache-2.0）包里自带的 PP-OCRv6 small 检测、识别模型（ONNX，onnxruntime 在 CPU 上跑）。路径直接指向包里的
文件、先核对 sha256，不让 rapidocr 去 modelscope 下载。rapidocr、onnxruntime 是 `retainpdf-pipeline[scan-ocr]` 这个 extra：
没装、模型对不上、加载失败时这一步跳过，`derived.formula_numbers.ocr_crop.skipped` 记原因，归一化和翻译照常。
设环境变量 `RETAINPDF_FORMULA_NUMBER_OCR=0` 也跳过（`disabled`）。
"""

from __future__ import annotations

import hashlib
import os
import re
import time
from pathlib import Path
from typing import Callable, Protocol

from retainpdf_pipeline.ocr.document_schema.formula_numbers import SOURCE_OCR_CROP
from retainpdf_pipeline.ocr.document_schema.formula_numbers import attach_found_number
from retainpdf_pipeline.ocr.document_schema.formula_numbers import block_bbox
from retainpdf_pipeline.ocr.document_schema.formula_numbers import count_numbered
from retainpdf_pipeline.ocr.document_schema.formula_numbers import number_position_blocked
from retainpdf_pipeline.ocr.document_schema.formula_numbers import page_size
from retainpdf_pipeline.ocr.document_schema.formula_numbers import pending_formulas

# 渲染：页宽约这么多像素。
TARGET_PAGE_WIDTH_PX = 2000
# 窄条：上下各放宽公式高度的这个比例（至少 STRIP_MIN_PAD_PX），离公式边缘 STRIP_GAP_PX 起，到页宽的 STRIP_EDGE_RATIO 为止。
STRIP_PAD_RATIO = 0.15
STRIP_MIN_PAD_PX = 4
STRIP_GAP_PX = 4
STRIP_EDGE_RATIO = 0.97
# 窄条太窄（公式贴着页边）就不截。
STRIP_MIN_WIDTH_PX = 16
# 识别时字框四边各扩这么多像素。
CROP_PAD_PX = 6
# 离公式最近的字框，和别的字框（纵向叠着）横向间隔不到「字框高度 × 这个比例」：挨着别的字，不收。
CROWDED_GAP_RATIO = 1.5
# 识别的置信度低于这个不收。
MIN_TEXT_SCORE = 0.5
# 检测出来的字框比字本身大一圈（DB 检测按 unclip_ratio 往外扩）：拿去和别的块比位置前，四边各收进「框高 × 这个比例」。
# 不收的话，编号框会蹭到上一行段落块的下沿（真实数据里一个 1 点的重叠就让 (5.8) 被当成落在段落里）。
GLYPH_INSET_RATIO = 0.2

ENV_SWITCH = "RETAINPDF_FORMULA_NUMBER_OCR"

# rapidocr 3.10.0 包里自带的模型（wheel 的 RECORD 里有），钉住 sha256：换了版本、文件不对就不用，不去下载。
RAPIDOCR_MODELS = {
    "det": ("PP-OCRv6_det_small.onnx", "090f04abcd9d9a7498bc4ebf677e4cb9bdce1fe4197ddb7e529f1ef44e1ff94f"),
    "rec": ("PP-OCRv6_rec_small.onnx", "6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884"),
}

Box = tuple[float, float, float, float]

_OPEN = "(（"
_CLOSE = ")）"
_CERTAIN_LABEL_RE = re.compile(r"^(?:[A-Z]{1,3}[.\-]?)?\d{1,4}(?:[.\-]\d{1,4}){0,3}[a-z]?$")
# 两段数字中间是空格或逗号：多半是点没认出来，只在前后编号接得上、补成「章.序」时才收。
_UNCERTAIN_LABEL_RE = re.compile(r"^(\d{1,3})(?:\s*,\s*|\s+)(\d{1,4})([a-z]?)$")


class EngineUnavailable(RuntimeError):
    """OCR 引擎用不了；`reason` 记进统计。"""

    def __init__(self, reason: str, detail: str = "") -> None:
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason


class FormulaNumberOcrEngine(Protocol):
    """截图识别引擎。`page_image` 是整页的灰度图（PIL），`region` 是其中一块（像素，x0, y0, x1, y1）。"""

    def detect(self, page_image, region: Box) -> list[Box]:
        """`region` 里的字框（整页像素坐标）。"""

    def recognize(self, page_image, region: Box) -> tuple[str, float]:
        """`region` 里的一行字和置信度。"""


class RapidOcrEngine:
    """rapidocr 包里自带的 PP-OCRv6 small 检测、识别（onnxruntime，CPU）。

    rapidocr 的 `use_det`、`use_rec`、`use_cls` 上一次调用传的值会被下一次沿用，所以每次调用三个都写全。
    """

    def __init__(self) -> None:
        try:
            import rapidocr
            from rapidocr import RapidOCR
        except Exception as exc:  # noqa: BLE001 —— 没装、或者装了但 import 失败（缺系统库）都算用不了
            raise EngineUnavailable("ocr_engine_unavailable", f"{type(exc).__name__}: {exc}") from exc
        model_dir = Path(rapidocr.__file__).resolve().parent / "models"
        paths = {}
        for task, (name, sha256) in RAPIDOCR_MODELS.items():
            path = model_dir / name
            if not path.is_file() or _sha256(path) != sha256:
                raise EngineUnavailable("ocr_model_unavailable", f"{name} missing or sha256 mismatch")
            paths[task] = str(path)
        try:
            self._ocr = RapidOCR(
                params={
                    "Global.log_level": "error",
                    "Global.use_cls": False,
                    "Det.model_path": paths["det"],
                    "Rec.model_path": paths["rec"],
                    # 不限制的话，检测会把窄条放大到短边 736 像素，一个公式要 2 秒。
                    "Det.limit_type": "max",
                    "Det.limit_side_len": 960,
                }
            )
            # 先各跑一次：模型在第一次调用时才加载，加载失败要在这里就知道。
            from PIL import Image

            blank = Image.new("L", (64, 32), 255)
            self._ocr(blank, use_det=True, use_cls=False, use_rec=False)
            self._ocr(blank, use_det=False, use_cls=False, use_rec=True)
        except Exception as exc:  # noqa: BLE001
            raise EngineUnavailable("ocr_engine_failed", f"{type(exc).__name__}: {exc}") from exc

    def detect(self, page_image, region: Box) -> list[Box]:
        x0, y0 = int(region[0]), int(region[1])
        result = self._ocr(
            page_image.crop(tuple(int(value) for value in region)), use_det=True, use_cls=False, use_rec=False
        )
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return []
        found = []
        for polygon in boxes:
            xs = [float(point[0]) for point in polygon]
            ys = [float(point[1]) for point in polygon]
            found.append((x0 + min(xs), y0 + min(ys), x0 + max(xs), y0 + max(ys)))
        return found

    def recognize(self, page_image, region: Box) -> tuple[str, float]:
        result = self._ocr(
            page_image.crop(tuple(int(value) for value in region)), use_det=False, use_cls=False, use_rec=True
        )
        texts = list(getattr(result, "txts", None) or [])
        scores = [float(score) for score in (getattr(result, "scores", None) or [])]
        return "".join(str(text) for text in texts), (min(scores) if scores else 0.0)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


_ENGINE_CACHE: dict[str, object] = {}


def load_default_engine() -> FormulaNumberOcrEngine:
    """进程里只加载一次（失败也只试一次）。用不了抛 `EngineUnavailable`。"""
    if "engine" not in _ENGINE_CACHE:
        try:
            _ENGINE_CACHE["engine"] = RapidOcrEngine()
        except EngineUnavailable as exc:
            _ENGINE_CACHE["engine"] = exc
    engine = _ENGINE_CACHE["engine"]
    if isinstance(engine, EngineUnavailable):
        raise engine
    return engine  # type: ignore[return-value]


def parse_ocr_number(text: str) -> tuple[str, str] | None:
    """识别出来的一段字 → (编号原样, 标签)；不像编号返回 None。

    要带圆括号（半角、全角都认）。`·`、`．` 当成点，`–`、`—` 当成连字符，分隔符两边的空格去掉。两段数字中间只有空格或逗号的
    （`(5 20)`、`(5,20)`），记成 `(5 20)` / 标签 `5 20`：点多半没认出来，留给补分隔符那一步，补不上就去掉。
    """
    raw = str(text or "").strip()
    if len(raw) < 3 or len(raw) > 24 or raw[0] not in _OPEN or raw[-1] not in _CLOSE:
        return None
    inner = raw[1:-1].strip()
    inner = inner.replace("·", ".").replace("．", ".").replace("–", "-").replace("—", "-").replace("－", "-")
    certain = re.sub(r"\s*([.\-])\s*", r"\1", inner)
    if _CERTAIN_LABEL_RE.match(certain):
        return f"{raw[0]}{certain}{raw[-1]}", certain
    uncertain = _UNCERTAIN_LABEL_RE.match(inner)
    if uncertain:
        label = f"{uncertain.group(1)} {uncertain.group(2)}{uncertain.group(3)}"
        return f"{raw[0]}{label}{raw[-1]}", label
    return None


def _render_page(pdf_page):
    import fitz
    from PIL import Image

    zoom = TARGET_PAGE_WIDTH_PX / max(float(pdf_page.rect.width), 1.0)
    pixmap = pdf_page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csGRAY, alpha=False)
    return Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)


def _blank(image) -> bool:
    """整页一点墨都没有（空白页）：没东西可认。"""
    from PIL import ImageOps

    return ImageOps.invert(image).getbbox() is None


def _crowded(nearest: Box, boxes: list[Box]) -> bool:
    height = nearest[3] - nearest[1]
    for other in boxes:
        if other is nearest:
            continue
        vertical = min(other[3], nearest[3]) - max(other[1], nearest[1])
        if vertical <= 0.5 * min(height, other[3] - other[1]):
            continue
        gap = max(other[0] - nearest[2], nearest[0] - other[2], 0.0)
        if gap < CROWDED_GAP_RATIO * height:
            return True
    return False


def _strip(side: str, formula_px: Box, image_size: tuple[int, int]) -> Box | None:
    width, height = image_size
    fx0, fy0, fx1, fy1 = formula_px
    pad = max(STRIP_MIN_PAD_PX, STRIP_PAD_RATIO * (fy1 - fy0))
    top, bottom = max(0.0, fy0 - pad), min(float(height), fy1 + pad)
    if side == "right":
        left, right = fx1 + STRIP_GAP_PX, STRIP_EDGE_RATIO * width
    else:
        left, right = (1 - STRIP_EDGE_RATIO) * width, fx0 - STRIP_GAP_PX
    if right - left < STRIP_MIN_WIDTH_PX or bottom - top < 1:
        return None
    return (left, top, right, bottom)


def _read_side(engine, image, side: str, formula_px: Box) -> tuple[str, Box | None, tuple[str, str] | None]:
    """一侧：(结果, 字框, 编号)。结果是 `found` / `no_text` / `crowded` / `not_a_number`。"""
    region = _strip(side, formula_px, image.size)
    if region is None:
        return "no_text", None, None
    boxes = [box for box in engine.detect(image, region) if box[2] > box[0] and box[3] > box[1]]
    if not boxes:
        return "no_text", None, None
    nearest = min(boxes, key=lambda box: box[0]) if side == "right" else max(boxes, key=lambda box: box[2])
    if _crowded(nearest, boxes):
        return "crowded", nearest, None
    crop = (
        max(0.0, nearest[0] - CROP_PAD_PX),
        max(0.0, nearest[1] - CROP_PAD_PX),
        min(float(image.size[0]), nearest[2] + CROP_PAD_PX),
        min(float(image.size[1]), nearest[3] + CROP_PAD_PX),
    )
    text, score = engine.recognize(image, crop)
    parsed = parse_ocr_number(text) if score >= MIN_TEXT_SCORE else None
    if parsed is None:
        return "not_a_number", nearest, None
    return "found", nearest, parsed


def _glyph_box(box: list[float]) -> list[float]:
    inset = GLYPH_INSET_RATIO * (box[3] - box[1])
    inset_x = min(inset, 0.25 * (box[2] - box[0]))
    return [box[0] + inset_x, box[1] + inset, box[2] - inset_x, box[3] - inset]


def _overlaps(a: list[float], b: list[float]) -> bool:
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


def attach_formula_numbers_from_page_images(
    document: dict,
    pdf,
    *,
    engine_loader: Callable[[], FormulaNumberOcrEngine] | None = None,
) -> int:
    """页上取不出文字（扫描件）的页，还没有编号的公式截图识别编号。返回补了几个（补分隔符、去掉补不上的在后面一步）。

    坐标必须已经是 PDF 的点（`rescale_document_geometry_to_pdf` 里、文字层兜底之后调）。要做的时候（有这样的页、页上有墨、
    有没配上的公式）才加载引擎；文档 `derived.formula_numbers.ocr_crop` 记 `pages`、`formulas`、`rejected`（没收的原因），
    引擎用不了记 `skipped`。
    """
    summary = (document.get("derived") or {}).get("formula_numbers")
    stats: dict = {"pages": 0, "formulas": 0, "rejected": {}}
    engine = None
    attached = 0
    started = time.perf_counter()
    for page_index, page in enumerate(document.get("pages", []) or []):
        if page_index >= len(pdf):
            break
        blocks = [block for block in page.get("blocks", []) or [] if isinstance(block, dict)]
        pending = [formula for formula in pending_formulas(blocks) if block_bbox(formula)]
        if not pending:
            continue
        pdf_page = pdf[page_index]
        # 和文字层兜底同一个口径：页上取得出字就是有文字层，那一步管。
        if pdf_page.get_text("words"):
            continue
        if "skipped" in stats:
            # 已经知道做不了：只计数，不再渲染。
            stats["pages"] += 1
            stats["formulas"] += len(pending)
            continue
        image = _render_page(pdf_page)
        if _blank(image):
            continue
        stats["pages"] += 1
        stats["formulas"] += len(pending)
        if engine is None:
            if os.environ.get(ENV_SWITCH, "").strip().lower() in {"0", "off", "false", "no"}:
                stats["skipped"] = "disabled"
                continue
            try:
                engine = (engine_loader or load_default_engine)()
            except EngineUnavailable as exc:
                stats["skipped"] = exc.reason
                print(f"normalize: formula number OCR skipped ({exc})", flush=True)
                continue
        attached += _attach_on_page(engine, image, page, blocks, pending, stats["rejected"])
    if stats["pages"] and isinstance(summary, dict):
        if "skipped" not in stats:
            print(
                f"normalize: formula number OCR read {attached} of {stats['formulas']} formulas "
                f"on {stats['pages']} scanned pages in {time.perf_counter() - started:.1f}s",
                flush=True,
            )
        summary[SOURCE_OCR_CROP] = stats
    count_numbered(document, SOURCE_OCR_CROP, attached)
    return attached


def _reject(rejected: dict, reason: str) -> None:
    rejected[reason] = int(rejected.get(reason, 0)) + 1


def _attach_on_page(engine, image, page: dict, blocks: list[dict], pending: list[dict], rejected: dict) -> int:
    page_width, page_height = page_size(page)
    scale = image.size[0] / max(page_width, 1e-6)
    found: list[tuple[dict, list[float], tuple[str, str]]] = []
    for formula in pending:
        formula_px = tuple(value * scale for value in block_bbox(formula))
        try:
            result, box_px, parsed = _read_side(engine, image, "right", formula_px)
            side = "right"
            if result == "no_text":
                # 右边一个字都没有才看左边（左边的序号要求公式右边同一行没有字，和文字层兜底一样）。
                result, box_px, parsed = _read_side(engine, image, "left", formula_px)
                side = "left"
        except Exception:  # noqa: BLE001 —— 一个公式认不出来不影响别的
            _reject(rejected, "ocr_error")
            continue
        if result != "found":
            _reject(rejected, result)
            continue
        box = _glyph_box([value / scale for value in box_px])
        if number_position_blocked(box=box, side=side, formula=formula, blocks=blocks, page_height=page_height):
            _reject(rejected, "other_block")
            continue
        found.append((formula, box, parsed))
    attached = 0
    for index, (formula, box, (text, label)) in enumerate(found):
        if any(_overlaps(box, other) for other_index, (_f, other, _p) in enumerate(found) if other_index != index):
            # 两个公式认到同一串字（编号在两个公式中间）：都不收。
            _reject(rejected, "contested")
            continue
        attach_found_number(formula, text=text, label=label, source=SOURCE_OCR_CROP)
        attached += 1
    return attached


__all__ = [
    "ENV_SWITCH",
    "EngineUnavailable",
    "FormulaNumberOcrEngine",
    "RAPIDOCR_MODELS",
    "RapidOcrEngine",
    "attach_formula_numbers_from_page_images",
    "load_default_engine",
    "parse_ocr_number",
]
