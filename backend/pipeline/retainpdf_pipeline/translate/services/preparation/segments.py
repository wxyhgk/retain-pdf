"""译前术语预扫的输入：把 OCR 文档切成「段」，再把段装成批。

段 = OCR 抽出的一个可翻译文本块（公式块、页眉页脚等元信息块、参考文献不进来）。
批 = 若干个相邻段，按「约 600 token 或 12 段，先到为准」切分。一个段本身超过
token 上限时独占一批，不截断——截断会把术语切成半个。

段里的行内公式 `$...$` / `$$...$$` 在送模型之前替换成 `[math]`：预扫不抽数学
符号和变量，把公式留在原文里只会诱导模型把 `x_i`、`\\alpha` 当术语交回来。
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math
import re

from retainpdf_pipeline.translate.core.ocr.json_extractor import extract_text_items

PRESCAN_BATCH_MAX_TOKENS = 600
PRESCAN_BATCH_MAX_SEGMENTS = 12
# 切批规则的版本。改了切法（上限、过滤条件、公式替换）就要升，旧的批结果
# 不能再拿来续跑。
SEGMENTATION_VERSION = "prescan-segments-v1"

_NON_PROSE_BLOCK_TYPES = frozenset({"formula", "equation", "code", "table", "image", "figure"})
_SKIPPED_ROLE_MARKERS = ("metadata", "reference", "bibliography")
_DISPLAY_MATH_RE = re.compile(r"\$\$.+?\$\$", re.S)
_INLINE_MATH_RE = re.compile(r"(?<!\\)\$(?:\\\$|[^$])+?(?<!\\)\$")
_CJK_RE = re.compile(r"[㐀-鿿豈-﫿]")
_LATIN_LETTER_RE = re.compile(r"[A-Za-z]")
_SPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class PrescanSegment:
    segment_id: str
    page_index: int
    order: int
    text: str


@dataclass(frozen=True)
class PrescanBatch:
    batch_id: str
    segments: tuple[PrescanSegment, ...]

    @property
    def input_sha256(self) -> str:
        payload = [[segment.segment_id, segment.text] for segment in self.segments]
        canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @property
    def token_estimate(self) -> int:
        return sum(estimate_tokens(segment.text) for segment in self.segments)


def estimate_tokens(text: str) -> int:
    """粗估 token 数：CJK 一字一 token，其余字符四个一 token。

    只用来决定在哪里切批，不需要和任何 provider 的 tokenizer 一致；
    但必须是确定性的，否则续跑时同一份文档会切出不同的批。
    """
    value = str(text or "")
    if not value:
        return 0
    cjk = len(_CJK_RE.findall(value))
    other = len(value) - cjk
    return cjk + int(math.ceil(other / 4))


def mask_math(text: str) -> str:
    masked = _DISPLAY_MATH_RE.sub(" [math] ", str(text or ""))
    masked = _INLINE_MATH_RE.sub(" [math] ", masked)
    return _SPACE_RE.sub(" ", masked).strip()


def _is_prescan_candidate(item) -> bool:
    if item.policy_translate is False:
        return False
    if str(item.block_type or "").strip().lower() in _NON_PROSE_BLOCK_TYPES:
        return False
    roles = " ".join(
        str(value or "").strip().lower()
        for value in (item.semantic_role, item.structure_role, item.layout_role)
    )
    return not any(marker in roles for marker in _SKIPPED_ROLE_MARKERS)


def collect_prescan_segments(data: dict, page_indices) -> list[PrescanSegment]:
    segments: list[PrescanSegment] = []
    for page_idx in page_indices:
        for item in extract_text_items(data, page_idx=page_idx):
            if not _is_prescan_candidate(item):
                continue
            text = mask_math(item.text)
            # 少于 3 个拉丁字母的段（页码、纯符号、纯中文）抽不出要翻译的术语。
            if len(_LATIN_LETTER_RE.findall(text)) < 3:
                continue
            segments.append(
                PrescanSegment(
                    segment_id=str(item.item_id or f"p{page_idx:03d}-{len(segments):05d}"),
                    page_index=int(page_idx),
                    order=len(segments),
                    text=text,
                )
            )
    return segments


def build_prescan_batches(
    segments: list[PrescanSegment],
    *,
    max_tokens: int = PRESCAN_BATCH_MAX_TOKENS,
    max_segments: int = PRESCAN_BATCH_MAX_SEGMENTS,
) -> list[PrescanBatch]:
    max_tokens = max(1, int(max_tokens))
    max_segments = max(1, int(max_segments))
    batches: list[PrescanBatch] = []
    current: list[PrescanSegment] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal current, current_tokens
        if current:
            batches.append(PrescanBatch(batch_id=f"b{len(batches):05d}", segments=tuple(current)))
        current = []
        current_tokens = 0

    for segment in segments:
        tokens = estimate_tokens(segment.text)
        if current and (current_tokens + tokens > max_tokens or len(current) >= max_segments):
            flush()
        current.append(segment)
        current_tokens += tokens
    flush()
    return batches


__all__ = [
    "PRESCAN_BATCH_MAX_SEGMENTS",
    "PRESCAN_BATCH_MAX_TOKENS",
    "PrescanBatch",
    "PrescanSegment",
    "SEGMENTATION_VERSION",
    "build_prescan_batches",
    "collect_prescan_segments",
    "estimate_tokens",
    "mask_math",
]
