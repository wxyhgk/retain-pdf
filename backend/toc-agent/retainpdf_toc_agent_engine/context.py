"""认上下文的接线（R2，2026-11-28）：文字层看不看得见、目录区域截图（叠行号）、跑核心循环、结果和缓存。

规则草稿由流水线给（``retainpdf_pipeline/ocr/document_schema/toc_pages.py`` 的 ``context_drafts``：和拆条目同一套规则，
规则不认的块也给出候选）；这里补上文字层可见不可见，算信号，拿不准的页（开了模型这一步时）截图问模型。
结果和缓存在 ``translated/toc-context.v1.json``：输入（草稿、正文标题、上次翻译退回的标题、模式、模型、提示词版本）
一样就直接用上次的结果，不再发请求；有请求失败的不缓存成定局。写回文档（重建条目块）由流水线做。
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Callable, Iterable

from retainpdf_base.io import save_json_atomic
from retainpdf_translation.llm.shared.model_wire import image_part

from retainpdf_toc_agent.context import CONTEXT_PROMPT_VERSION
from retainpdf_toc_agent.context import TEXT_LAYER_INVISIBLE
from retainpdf_toc_agent.context import TEXT_LAYER_VISIBLE
from retainpdf_toc_agent.context import PageDraft
from retainpdf_toc_agent.context import PageOutcome
from retainpdf_toc_agent.context import heading_keys_of
from retainpdf_toc_agent.context import page_signals
from retainpdf_toc_agent.context import resolve_page
from retainpdf_toc_agent.context.signals import TRANSLATION_REJECT_REASONS
from retainpdf_toc_agent.match import title_key

CONTEXT_RESULT_FILE_NAME = "toc-context.v1.json"
CONTEXT_SCHEMA = "toc_context_result_v1"
# 子开关（挂在 translation.toc = agent 下面）：off 不跑；rules 只算信号、记下会问哪几页（不发请求、不改文档）；
# model 拿不准的页问模型、改了就写回文档。R3 Haiku 实测前默认 off（合了不改默认行为）
CONTEXT_MODES = ("off", "rules", "model")
DEFAULT_CONTEXT_MODE = "off"
SCREENSHOT_LONG_SIDE = 1400
SCREENSHOT_MAX_ZOOM = 4.0
SCREENSHOT_MAX_BYTES = 3_500_000
LINE_NUMBER_GUTTER_PT = 16.0
LINE_NUMBER_COLOR = (0.85, 0.25, 0.2)
LINE_NUMBER_OPACITY = 0.55
INVISIBLE_SHARE = 0.5


def normalize_context_mode(value: Any) -> str:
    mode = str(value or DEFAULT_CONTEXT_MODE).strip().lower()
    return mode if mode in CONTEXT_MODES else DEFAULT_CONTEXT_MODE


def text_layer_kind(page: Any, region: Iterable[float]) -> str:
    """目录区域里的字大多是看不见的（扫描件上的 OCR 文字层，绘字模式 3）就是 invisible。"""
    x0, y0, x1, y1 = (float(value) for value in region)
    visible = invisible = 0
    for span in page.get_texttrace():
        sx0, sy0, sx1, sy1 = span.get("bbox") or (0, 0, 0, 0)
        cx, cy = (sx0 + sx1) / 2, (sy0 + sy1) / 2
        if not (x0 - 2 <= cx <= x1 + 2 and y0 - 2 <= cy <= y1 + 2):
            continue
        count = len(span.get("chars") or ())
        if span.get("type") == 3 or float(span.get("opacity", 1.0) or 0.0) == 0.0:
            invisible += count
        else:
            visible += count
    return TEXT_LAYER_INVISIBLE if invisible and invisible >= (visible + invisible) * INVISIBLE_SHARE else TEXT_LAYER_VISIBLE


def toc_page_screenshot(page: Any, draft: PageDraft, *, long_side: int = SCREENSHOT_LONG_SIDE) -> tuple[bytes, str]:
    """目录区域截图，左边叠淡色行号（和草稿的视觉行号一样）。原页不改：在一份临时文档上画。"""
    import fitz

    rect = page.rect
    x0, y0, x1, y1 = draft.region
    clip = fitz.Rect(max(rect.x0, x0 - LINE_NUMBER_GUTTER_PT), max(rect.y0, y0 - 3), min(rect.x1, x1 + 3), min(rect.y1, y1 + 3))
    lines: dict[int, list[float]] = {}
    for fragment in draft.fragments:
        box = lines.setdefault(fragment.line, [fragment.bbox[1], fragment.bbox[3]])
        box[0], box[1] = min(box[0], fragment.bbox[1]), max(box[1], fragment.bbox[3])
    scratch = fitz.open()
    try:
        canvas = scratch.new_page(width=rect.width, height=rect.height)
        canvas.show_pdf_page(canvas.rect, page.parent, page.number)
        for line, (top, bottom) in sorted(lines.items()):
            size = max(4.0, min(7.0, (bottom - top) * 0.7))
            canvas.insert_text((clip.x0 + 1, bottom - (bottom - top - size) / 2 - 1), str(line), fontsize=size,
                               color=LINE_NUMBER_COLOR, fill_opacity=LINE_NUMBER_OPACITY)
        longest = max(clip.width, clip.height, 1.0)
        zoom = min(long_side / longest, SCREENSHOT_MAX_ZOOM)
        pixmap = canvas.get_pixmap(dpi=max(36, round(72 * zoom)), clip=clip, alpha=False)
        data = pixmap.tobytes("png")
        if len(data) <= SCREENSHOT_MAX_BYTES:
            return data, "image/png"
        return pixmap.tobytes("jpeg"), "image/jpeg"
    finally:
        scratch.close()


def _digest(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def _read_cached(path: Path, digest: str) -> dict | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(payload, dict) or payload.get("input_sha256") != digest:
        return None
    pages = payload.get("pages") or []
    # 有请求失败的不当成定局：下次再试
    return None if any(page.get("status") == "request_failed" for page in pages) else payload


def rejected_title_keys(output_dir: Path) -> frozenset[str]:
    """上一次目录翻译（``toc-agent.v1.json``）检查退回、而且是数字对不上的标题：多半是章号页码混进了标题、或条目拆错了。"""
    try:
        payload = json.loads((Path(output_dir) / "toc-agent.v1.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return frozenset()
    rejected = payload.get("rejected") if isinstance(payload, dict) else None
    return frozenset(title_key(title) for title, reason in (rejected or {}).items() if reason in TRANSLATION_REJECT_REASONS)


def toc_context(
    drafts: list[dict],
    *,
    pdf: Any,
    output_dir: Path,
    mode: str,
    chat_fn: Callable[..., Any] | None = None,
    model_identity: dict | None = None,
    heading_texts: Iterable[str] = (),
    with_image: bool = True,
) -> list[PageOutcome]:
    """每页的结果（``PageOutcome``，状态和要对文档做什么见核心 ``context.agent``）。``drafts`` 是流水线给的规则草稿。

    ``mode``：rules 只算信号不发请求；model 拿不准的页问模型（``chat_fn`` 由调用方给，测试注入假的）。"""
    mode = normalize_context_mode(mode)
    if mode == "off" or not drafts:
        return []
    pages: list[PageDraft] = []
    for data in drafts:
        draft = PageDraft.from_dict(data)
        if "text_layer" not in data and pdf is not None and 0 <= draft.page_index < len(pdf):
            draft.text_layer = text_layer_kind(pdf[draft.page_index], draft.region)
        pages.append(draft)
    headings = heading_keys_of(heading_texts)
    rejected = rejected_title_keys(output_dir)
    ask_model = mode == "model" and chat_fn is not None
    digest = _digest({
        "prompt_version": CONTEXT_PROMPT_VERSION,
        "mode": mode,
        "with_image": bool(with_image),
        "model": (model_identity or {}) if mode == "model" else {},
        "drafts": [draft.to_dict() for draft in pages],
        "headings": sorted(headings),
        "rejected": sorted(rejected),
    })
    path = Path(output_dir) / CONTEXT_RESULT_FILE_NAME
    cached = _read_cached(path, digest)
    if cached is not None:
        outcomes = [PageOutcome.from_record(record) for record in cached.get("pages") or []]
        print(f"toc context: reuse {len(outcomes)} pages", flush=True)
        return outcomes
    outcomes = []
    for draft in pages:
        signals = page_signals(draft, heading_keys=headings, rejected_title_keys=rejected)
        image = None
        if ask_model and signals and with_image and pdf is not None:
            try:
                data, media_type = toc_page_screenshot(pdf[draft.page_index], draft)
                image = image_part(data, media_type)
            except Exception as error:  # noqa: BLE001 - 截不了图就只发文字
                print(f"toc context: page {draft.page_index + 1} screenshot failed ({type(error).__name__}: {error})", flush=True)
        outcomes.append(resolve_page(draft, signals=signals, chat_fn=chat_fn, image=image, ask_model=ask_model))
    record = {
        "schema": CONTEXT_SCHEMA,
        "input_sha256": digest,
        "mode": mode,
        "prompt_version": CONTEXT_PROMPT_VERSION,
        "summary": summarize(outcomes),
        "pages": [outcome.to_record() for outcome in outcomes],
    }
    save_json_atomic(path, record)
    summary = record["summary"]
    print(f"toc context: mode={mode} pages={summary['pages']} flagged={summary['flagged']} "
          f"statuses={summary['statuses']} requests={summary['requests']}", flush=True)
    return outcomes


def summarize(outcomes: list[PageOutcome]) -> dict:
    statuses: dict[str, int] = {}
    signals: dict[str, int] = {}
    usage: dict[str, int] = {}
    for outcome in outcomes:
        statuses[outcome.status] = statuses.get(outcome.status, 0) + 1
        for signal in outcome.signals:
            signals[signal] = signals.get(signal, 0) + 1
        for key, value in outcome.usage.items():
            usage[key] = usage.get(key, 0) + int(value)
    return {
        "pages": len(outcomes),
        "flagged": sum(1 for outcome in outcomes if outcome.signals),
        "statuses": statuses,
        "signals": signals,
        "requests": sum(outcome.requests for outcome in outcomes),
        "usage": usage,
    }


__all__ = [
    "CONTEXT_MODES",
    "CONTEXT_RESULT_FILE_NAME",
    "DEFAULT_CONTEXT_MODE",
    "normalize_context_mode",
    "rejected_title_keys",
    "summarize",
    "text_layer_kind",
    "toc_context",
    "toc_page_screenshot",
]
