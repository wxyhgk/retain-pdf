"""GLM-OCR 驱动：原文按页分片交给 GLM-OCR，拼成一份原始结果，从原文裁图，归一化成 document.v1。

在 provider worker 里跑（和命令型 OCR、Paddle 官方 CLI 一样），Rust 只拉起进程、注入凭据（`args.ocr_credential`）。

- 分片：每片 `RETAIN_GLM_OCR_CHUNK_PAGES` 页（默认 10，服务端上限 100）。2026-10-31 实测 34 页论文：10 页一片每片约 12 秒，
  总用量和一次交 34 页一样（109802 对 109799 tokens），所以片小一点只换来更细的进度和断点，不多花钱。
- 并发：`RETAIN_GLM_OCR_WORKERS`（默认 1）。同一实测 2 路并发 50.6 秒、串行 48.7 秒，没变快（服务端看来按 key 排队）；
  外部 CLI 3 路 × 100 页必吃 429。
- 断点：每片的原始结果存在 `ocr/glm_ocr_raw/chunk-<序号>-<起>-<止>.json`，`chunks.json` 记原文的 sha256 和分片页数；
  重跑同一个任务时两者都对得上的片不再请求（不再花钱）。
- 共用缓存（2026-11-02）：每片结果另存一份到输出目录下的 `_glm_ocr_chunk_cache/<原文 sha256>/<模型>-p<分片页数>/`，
  各任务共用。OCR 中断、失败以后新建或重试的任务（任务目录是新的）也不再为做过的片付钱。键里有原文的 sha256，
  换了文件、模型或分片页数都对不上，不会用错；片的页数不对的结果不存也不用。
- 每做完一片报一次进度（页），任务的"多久没有进展"超时按它算。
- 选页（`page_ranges`）：先从原文切出所选页的子 PDF 当原文，和 Rust 那边 Paddle 的做法一致，下游的页号都对得上。
- 图片：GLM 不回传图片，按块的框从原文裁（`md/images/page-<N>/imgs/img_in_<标签>_box_….jpg`，和 Paddle 的图片放一处，
  阅读页、AI 工具照原样找得到），裁好的路径填进原始结果的 `_images` 给适配器挂到块上。
- `md/full.md`：GLM 的整份 markdown，图片占位 `![](page=<片内页>,bbox=[…])` 换成本地裁好的图。
- 流式公布（`retainpdf_base/ocr_stream.py`）：每做完一片（续跑时先把已有的片一起），把前面连着做完的页归一化成文档写到
  `ocr/stream/`，后面的跨栏跨页拼接和翻译不用等整个 OCR 阶段（2026-10-31，OCR 和翻译并行）。前缀页和最后整份文档的同一页逐字节一致
  （试过 50 页前缀对 100 页整份）；100 页归一化 0.4 秒，所以每片都把前缀整个重做，不拼接。图片只裁新到的页。
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

import fitz

from retainpdf_base import paths
from retainpdf_base.events import emit_stage_progress
from retainpdf_base.io import save_json
from retainpdf_base.io import save_json_atomic
from retainpdf_pipeline.foundation.shared.job_dirs import job_dirs_from_explicit_args
from retainpdf_base.ocr_stream import OcrStreamWriter
from retainpdf_pipeline.ocr.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.finalize import finalize_normalized_document
from retainpdf_pipeline.ocr.document_schema.provider_adapters.glm_ocr.adapter import IMAGE_LABELS
from retainpdf_pipeline.ocr.document_schema.provider_adapters.glm_ocr.adapter import image_asset_key
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GLM_OCR
from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_repair import split_cross_column_blocks
from retainpdf_pipeline.ocr.ocr_provider.paddle_markdown import job_markdown_dir
from retainpdf_pipeline.ocr.ocr_provider.paddle_markdown import job_markdown_images_dir
from retainpdf_pipeline.ocr.ocr_provider.types import OcrProviderResult

CHUNK_PAGES_ENV = "RETAIN_GLM_OCR_CHUNK_PAGES"
WORKERS_ENV = "RETAIN_GLM_OCR_WORKERS"
DEFAULT_CHUNK_PAGES = 10
DEFAULT_WORKERS = 1
MAX_WORKERS = 4
CROP_DPI = 200

RESULT_FILE_NAME = "glm_ocr_result.json"
RAW_DIR_NAME = "glm_ocr_raw"
MANIFEST_FILE_NAME = "chunks.json"

_PLACEHOLDER_RE = re.compile(
    r"!\[[^\]]*\]\(page=(\d+),bbox=\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]\)"
)


def _env_int(name: str, default: int, *, low: int, high: int) -> int:
    raw = str(os.environ.get(name, "") or "").strip()
    try:
        value = int(raw) if raw else default
    except ValueError:
        value = default
    return min(high, max(low, value))


def parse_page_ranges(spec: str, page_count: int) -> list[int]:
    """`1-3,5` → 0 起的页号（排好序、去重）。空或 `all` 是全部页；越界、写反、写错都报错。"""
    text = str(spec or "").strip().lower()
    if not text or text == "all":
        return list(range(page_count))
    pages: set[int] = set()
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        first, _, last = part.partition("-")
        try:
            start = int(first)
            end = int(last) if last.strip() else start
        except ValueError:
            raise RuntimeError(f"page_ranges 写法不对：{spec!r}") from None
        if start < 1 or end < start or end > page_count:
            raise RuntimeError(f"page_ranges 超出原文页数（共 {page_count} 页）：{spec!r}")
        pages.update(range(start - 1, end))
    if not pages:
        raise RuntimeError(f"page_ranges 没有选中任何页：{spec!r}")
    return sorted(pages)


def chunk_ranges(page_count: int, chunk_pages: int) -> list[tuple[int, int]]:
    """0 起、左闭右开的分片。"""
    return [(start, min(start + chunk_pages, page_count)) for start in range(0, page_count, chunk_pages)]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def prepare_source_pdf(args: SimpleNamespace, source_dir: Path) -> Path:
    """上传的原文；选了页就切出所选页的子 PDF 当原文。Paddle 按片提交（`paddle_chunked.py`）也用。"""
    raw_path = str(getattr(args, "file_path", "") or "").strip()
    if not raw_path:
        raise RuntimeError("只支持上传的本地文件（不支持 source.file_url）")
    source_pdf = Path(raw_path).resolve()
    if not source_pdf.is_file():
        raise RuntimeError(f"找不到原文 PDF：{source_pdf}")
    with fitz.open(source_pdf) as document:
        page_count = document.page_count
        selected = parse_page_ranges(str(getattr(args, "page_ranges", "") or ""), page_count)
        if len(selected) == page_count:
            return source_pdf
        subset_path = source_dir / f"{source_pdf.stem}.pages.pdf"
        with fitz.open() as subset:
            for page_index in selected:
                subset.insert_pdf(document, from_page=page_index, to_page=page_index)
            subset.save(subset_path)
    return subset_path


def _chunk_path(raw_dir: Path, index: int, start: int, end: int) -> Path:
    return raw_dir / f"chunk-{index:03d}-{start + 1}-{end}.json"


def _load_manifest(raw_dir: Path) -> dict:
    try:
        return json.loads((raw_dir / MANIFEST_FILE_NAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def shared_chunk_dir(cache_root: Path, source_hash: str, chunk_pages: int) -> Path:
    """各任务共用的分片缓存目录：同一份原文、同一个模型、同样的分片页数才是同一个目录。"""
    return cache_root / source_hash / f"{glm_ocr_api.GLM_OCR_MODEL}-p{chunk_pages}"


def _cached_chunk(path: Path, expected_pages: int) -> dict | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return payload if _chunk_is_complete(payload, expected_pages) else None


def _chunk_is_complete(payload: dict, expected_pages: int) -> bool:
    layout = payload.get("layout_details") if isinstance(payload, dict) else None
    pages = ((payload.get("data_info") or {}).get("pages") if isinstance(payload, dict) else None) or []
    return isinstance(layout, list) and len(layout) == expected_pages and len(pages) == expected_pages


def _chunk_bytes(source: fitz.Document, start: int, end: int) -> bytes:
    with fitz.open() as subset:
        subset.insert_pdf(source, from_page=start, to_page=end - 1)
        return subset.tobytes()


def request_chunks(
    source_pdf: Path,
    raw_dir: Path,
    *,
    api_key: str,
    chunk_pages: int,
    workers: int,
    parse=None,
    on_prefix: Callable[[list[dict]], None] | None = None,
    cache_root: Path | None = None,
) -> list[dict]:
    """逐片请求（命中断点或共用缓存的片不请求），返回按页序排好的各片原始结果。`parse` 只给测试注入假接口。

    `on_prefix`：前面连着做完的片变多了就调一次，传这些片（续跑时先传断点里连着的那些）。
    `cache_root`：各任务共用的分片缓存（`paths.GLM_OCR_CHUNK_CACHE_DIR`）；None 不用。"""
    parse = parse or glm_ocr_api.parse_pdf
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_hash = _sha256(source_pdf)
    shared_dir = shared_chunk_dir(cache_root, source_hash, chunk_pages) if cache_root is not None else None
    manifest = _load_manifest(raw_dir)
    reuse = manifest.get("source_sha256") == source_hash and manifest.get("chunk_pages") == chunk_pages
    save_json(raw_dir / MANIFEST_FILE_NAME, {"source_sha256": source_hash, "chunk_pages": chunk_pages})
    with fitz.open(source_pdf) as source:
        page_count = source.page_count
        ranges = chunk_ranges(page_count, chunk_pages)
        results: dict[int, dict] = {}
        todo: list[tuple[int, int, int, bytes]] = []
        shared_hits = 0
        for index, (start, end) in enumerate(ranges):
            local_path = _chunk_path(raw_dir, index, start, end)
            cached = _cached_chunk(local_path, end - start) if reuse else None
            if cached is None and shared_dir is not None:
                cached = _cached_chunk(_chunk_path(shared_dir, index, start, end), end - start)
                if cached is not None:
                    shared_hits += 1
                    save_json(local_path, cached)  # 任务目录照旧有全部原始片
            if cached is not None:
                results[index] = cached
            else:
                todo.append((index, start, end, _chunk_bytes(source, start, end)))
    done_pages = sum(ranges[index][1] - ranges[index][0] for index in results)
    print(
        f"glm-ocr: pages={page_count} chunks={len(ranges)} cached={len(results)} shared={shared_hits} todo={len(todo)} workers={workers}",
        flush=True,
    )
    _emit_progress(done_pages, page_count, f"GLM-OCR 识别中：{done_pages}/{page_count} 页")
    published = 0

    def publish_prefix() -> None:
        nonlocal published
        prefix = 0
        while prefix in results:
            prefix += 1
        if on_prefix is not None and prefix > published:
            published = prefix
            on_prefix([results[index] for index in range(prefix)])

    publish_prefix()

    def one(task: tuple[int, int, int, bytes]) -> tuple[int, dict]:
        index, start, end, pdf_bytes = task
        payload = parse(pdf_bytes, api_key=api_key)
        if not _chunk_is_complete(payload, end - start):
            raise RuntimeError(f"GLM-OCR 第 {start + 1}-{end} 页的结果页数不对（应为 {end - start} 页）")
        save_json(_chunk_path(raw_dir, index, start, end), payload)
        if shared_dir is not None:
            # 几个任务可能同时做同一份原文：整份写好再换上，读的一方看不到写了一半的文件
            save_json_atomic(_chunk_path(shared_dir, index, start, end), payload)
        return index, payload

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        for index, payload in pool.map(one, todo):
            results[index] = payload
            start, end = ranges[index]
            done_pages += end - start
            tokens = (payload.get("usage") or {}).get("total_tokens")
            print(f"glm-ocr: chunk {start + 1}-{end} done tokens={tokens}", flush=True)
            _emit_progress(done_pages, page_count, f"GLM-OCR 识别中：{done_pages}/{page_count} 页")
            publish_prefix()
    return [results[index] for index in range(len(ranges))]


def _emit_progress(current: int, total: int, message: str) -> None:
    emit_stage_progress(
        stage="ocr_processing",
        substage="glm_ocr",
        message=message,
        stage_detail=message,
        provider=PROVIDER_GLM_OCR,
        progress_current=current,
        progress_total=total,
        payload={"progress_unit": "page"},
    )


def merge_chunks(chunks: list[dict], *, chunk_pages: int) -> dict:
    """各片拼成一份同样形状的原始结果（适配器只认这一种）。`md_results` 里的图片占位页号换成全书 0 起的页号。"""
    layout_details: list = []
    pages_meta: list = []
    markdown_parts: list[str] = []
    meta_chunks: list[dict] = []
    usage_total: dict[str, int] = {}
    for index, chunk in enumerate(chunks):
        offset = index * chunk_pages
        count = len(chunk.get("layout_details") or [])
        layout_details.extend(chunk.get("layout_details") or [])
        pages_meta.extend((chunk.get("data_info") or {}).get("pages") or [])
        markdown = str(chunk.get("md_results") or "")
        markdown_parts.append(
            _PLACEHOLDER_RE.sub(lambda m, offset=offset: m.group(0).replace(f"page={m.group(1)},", f"page={int(m.group(1)) + offset},", 1), markdown)
        )
        usage = dict(chunk.get("usage") or {})
        for key, value in usage.items():
            if isinstance(value, int):
                usage_total[key] = usage_total.get(key, 0) + value
        meta_chunks.append(
            {"start_page": offset + 1, "end_page": offset + count, "request_id": chunk.get("request_id") or chunk.get("id") or "", "usage": usage}
        )
    return {
        "model": (chunks[0].get("model") if chunks else "") or glm_ocr_api.GLM_OCR_MODEL,
        "data_info": {"num_pages": len(pages_meta), "pages": pages_meta},
        "layout_details": layout_details,
        "md_results": "\n\n".join(part for part in markdown_parts if part.strip()),
        "usage": usage_total,
        "_meta": {"chunks": meta_chunks, "chunk_pages": chunk_pages},
    }


def _clamp(bbox: list, width: float, height: float) -> tuple[float, float, float, float] | None:
    if width <= 0 or height <= 0 or len(bbox) != 4:
        return None
    x1, y1, x2, y2 = (float(value) for value in bbox)
    x1, x2 = max(0.0, min(x1, width)), max(0.0, min(x2, width))
    y1, y2 = max(0.0, min(y1, height)), max(0.0, min(y2, height))
    return (x1, y1, x2, y2) if x2 > x1 and y2 > y1 else None


def crop_images(payload: dict, source_pdf: Path, job_root: Path, *, first_page: int = 0) -> dict[str, str]:
    """按图片块的框从原文裁图。返回 {`page-<N>/<键>`: 相对 `md/` 的路径}；裁不出来的（框是空的、越界）跳过并记日志。

    `first_page`：从这一页（0 起）裁起，前面的页流式公布时已经裁过。"""
    images_root = job_markdown_images_dir(job_root)
    pages_meta = (payload.get("data_info") or {}).get("pages") or []
    cropped: dict[str, str] = {}
    skipped = 0
    with fitz.open(source_pdf) as source:
        for page_index, blocks in enumerate(payload.get("layout_details") or []):
            if page_index < first_page:
                continue
            if page_index >= source.page_count or page_index >= len(pages_meta):
                break
            meta = pages_meta[page_index] or {}
            width, height = float(meta.get("width") or 0), float(meta.get("height") or 0)
            page = source[page_index]
            for block in blocks or []:
                label = str(block.get("native_label") or block.get("label") or "")
                if label not in IMAGE_LABELS:
                    continue
                bbox = list(block.get("bbox_2d") or [])
                clip = _clamp(bbox, width, height)
                if clip is None:
                    skipped += 1
                    continue
                key = image_asset_key(label, bbox)
                relative = Path(f"page-{page_index + 1}") / key
                target = images_root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                rect = page.rect
                x1, y1, x2, y2 = clip
                pixmap = page.get_pixmap(
                    dpi=CROP_DPI,
                    clip=fitz.Rect(x1 / width * rect.width, y1 / height * rect.height, x2 / width * rect.width, y2 / height * rect.height),
                )
                pixmap.save(target, output="jpeg")
                cropped[relative.as_posix()] = (Path("images") / relative).as_posix()
    if skipped:
        print(f"glm-ocr: skipped {skipped} image blocks with empty bbox", flush=True)
    return cropped


def write_full_markdown(payload: dict, cropped: dict[str, str], job_root: Path) -> Path | None:
    markdown = str(payload.get("md_results") or "")
    if not markdown.strip():
        return None
    layout_details = payload.get("layout_details") or []

    def replace(match: re.Match) -> str:
        page_index = int(match.group(1))
        bbox = [float(match.group(i)) for i in range(2, 6)]
        for block in layout_details[page_index] if page_index < len(layout_details) else []:
            label = str(block.get("native_label") or block.get("label") or "")
            if label in IMAGE_LABELS and [round(float(v)) for v in block.get("bbox_2d") or []] == [round(v) for v in bbox]:
                path = cropped.get(f"page-{page_index + 1}/{image_asset_key(label, block['bbox_2d'])}")
                if path:
                    return f"![]({path})"
        return match.group(0)

    markdown_dir = job_markdown_dir(job_root)
    markdown_dir.mkdir(parents=True, exist_ok=True)
    full_md_path = markdown_dir / "full.md"
    full_md_path.write_text(_PLACEHOLDER_RE.sub(replace, markdown).strip() + "\n", encoding="utf-8")
    return full_md_path


def _normalize(payload: dict, *, document_id: str, source_json_path: Path, source_pdf: Path) -> tuple[dict, dict]:
    document, report = adapt_payload_to_document_v1_with_report(
        payload=payload,
        provider=PROVIDER_GLM_OCR,
        document_id=document_id,
        source_json_path=source_json_path,
        provider_version=str(payload.get("model") or ""),
    )
    return finalize_normalized_document(document, report, source_pdf)


def run_glm_ocr_to_job_dir(args: SimpleNamespace, *, parse=None) -> OcrProviderResult:
    job_dirs = job_dirs_from_explicit_args(args)
    job_dirs.source_dir.mkdir(parents=True, exist_ok=True)
    source_pdf = prepare_source_pdf(args, job_dirs.source_dir)
    raw_dir = job_dirs.ocr_dir / RAW_DIR_NAME
    chunk_pages = _env_int(CHUNK_PAGES_ENV, DEFAULT_CHUNK_PAGES, low=1, high=glm_ocr_api.GLM_OCR_MAX_PAGES_PER_REQUEST)
    workers = _env_int(WORKERS_ENV, DEFAULT_WORKERS, low=1, high=MAX_WORKERS)
    provider_result_json_path = job_dirs.ocr_dir / RESULT_FILE_NAME
    document_id = job_dirs.root.name
    with fitz.open(source_pdf) as source:
        total_pages = source.page_count
    stream = OcrStreamWriter(job_dirs.ocr_dir, provider=PROVIDER_GLM_OCR, total_pages=total_pages)
    cropped: dict[str, str] = {}
    cropped_pages = 0

    def publish(prefix_chunks: list[dict]) -> None:
        nonlocal cropped_pages
        prefix = merge_chunks(prefix_chunks, chunk_pages=chunk_pages)
        split_cross_column_blocks(prefix, source_pdf)
        cropped.update(crop_images(prefix, source_pdf, job_dirs.root, first_page=cropped_pages))
        cropped_pages = len(prefix["layout_details"])
        prefix["_images"] = dict(cropped)
        document, _report = _normalize(prefix, document_id=document_id, source_json_path=provider_result_json_path, source_pdf=source_pdf)
        stream.publish(document)  # done 只在最后整份文档、full.md 都写好以后标

    try:
        chunks = request_chunks(
            source_pdf,
            raw_dir,
            api_key=str(getattr(args, "ocr_credential", "") or "").strip(),
            chunk_pages=chunk_pages,
            workers=workers,
            parse=parse,
            on_prefix=publish,
            cache_root=paths.GLM_OCR_CHUNK_CACHE_DIR,
        )
        payload = merge_chunks(chunks, chunk_pages=chunk_pages)
        split_cross_column_blocks(payload, source_pdf)
        cropped.update(crop_images(payload, source_pdf, job_dirs.root, first_page=cropped_pages))
        payload["_images"] = dict(cropped)
        markdown_path = write_full_markdown(payload, cropped, job_dirs.root)
        save_json(provider_result_json_path, payload)

        normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
        normalized_report_json_path = normalized_json_path.with_name(DOCUMENT_SCHEMA_REPORT_FILE_NAME)
        normalized_json_path.parent.mkdir(parents=True, exist_ok=True)
        document, report = _normalize(payload, document_id=document_id, source_json_path=provider_result_json_path, source_pdf=source_pdf)
        save_json(normalized_json_path, document)
        save_json(normalized_report_json_path, report)
        stream.publish(document, done=True)
    except BaseException as error:
        # 读流的一方（翻译）别再等：标成失败，原因只写类型和第一行（不带 key，parse_pdf 的报错本来就不带）
        stream.fail(f"{type(error).__name__}: {str(error).splitlines()[0] if str(error) else ''}")
        raise
    usage = payload.get("usage") or {}
    print(f"glm-ocr: done pages={len(payload['layout_details'])} images={len(cropped)} total_tokens={usage.get('total_tokens')}", flush=True)
    return OcrProviderResult(
        job_dirs=job_dirs,
        source_pdf_path=source_pdf,
        provider_result_json_path=provider_result_json_path,
        normalized_json_path=normalized_json_path,
        normalized_report_json_path=normalized_report_json_path,
        provider_raw_dir=raw_dir,
        raw_main_payload_path=provider_result_json_path,
        markdown_dir=markdown_path.parent if markdown_path else None,
        image_dir=job_markdown_images_dir(job_dirs.root) if cropped else None,
    )


__all__ = [
    "RAW_DIR_NAME",
    "RESULT_FILE_NAME",
    "chunk_ranges",
    "crop_images",
    "merge_chunks",
    "parse_page_ranges",
    "prepare_source_pdf",
    "request_chunks",
    "run_glm_ocr_to_job_dir",
    "shared_chunk_dir",
]
