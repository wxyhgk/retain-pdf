"""Paddle 按片并行提交，做完一片就公布前面连着做完的页（OCR 和翻译并行用）。

Paddle 官方接口是"提交任务 → 轮询 → 全部做完才给结果"，没法边识别边拿已做完的页。所以原文由我们切成小份，各自提交成一个任务。
2026-11-01 实测（34 页论文，每次文件内容不同、避开服务端缓存）：整份一个任务 46 秒、94 秒；切 4 份同时提交 10.9 秒、23.8 秒
——同一个 token 的几个任务是真并行的（GLM 不是）。但排队时间波动很大，有一轮一份 4 页的排了 79 秒才开始。用户："可以"。

- 每片 `RETAIN_PADDLE_CHUNK_PAGES` 页（默认 10），同时最多 `RETAIN_PADDLE_CHUNK_WORKERS` 片（默认 4）。
- **防排队卡住**：没有等着提交的片了、某一片提交超过 `RETAIN_PADDLE_HEDGE_SECONDS`（默认 15）秒还一页都没识别，就把同一份再交一次，
  谁先做完用谁（每片最多加交一次，多花的只是这一小份）。
- 失败的片重交，最多 3 次。
- 每片的结果存在 `ocr/paddle_raw_chunks/`，按原文 sha256 和分片页数续跑（和 GLM 一样），重跑不再花钱。
- 拼接：各片的 `global_block_id` / `global_group_id` 都从 0 编，原样拼起来不同片的块会被当成同一个接续组
  （Paddle 适配器按 `global_group_id` 分组），所以每片加上前面各片的最大编号。跨片的接续 Paddle 不知道，交给翻译那边自己判断。
- 每做完一片（前面连着的都做完了）就归一化前缀，公布到 `ocr/stream/`；图片（Paddle 给的是带签名的链接）最后整份一次下载。
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Callable

import fitz

from retainpdf_base.events import emit_stage_progress
from retainpdf_base.io import save_json
from retainpdf_base.ocr_stream import OcrStreamWriter
from retainpdf_pipeline.foundation.shared.job_dirs import job_dirs_from_explicit_args
from retainpdf_pipeline.ocr.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from retainpdf_pipeline.ocr.ocr_provider import paddle_api
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import chunk_ranges
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import prepare_source_pdf
from retainpdf_pipeline.ocr.ocr_provider.paddle_markdown import materialize_paddle_markdown_artifacts
from retainpdf_pipeline.ocr.ocr_provider.paddle_normalize import build_normalized_document_for_paddle
from retainpdf_pipeline.ocr.ocr_provider.paddle_normalize import save_normalized_document_for_paddle

CHUNK_PAGES_ENV = "RETAIN_PADDLE_CHUNK_PAGES"
WORKERS_ENV = "RETAIN_PADDLE_CHUNK_WORKERS"
HEDGE_SECONDS_ENV = "RETAIN_PADDLE_HEDGE_SECONDS"
DEFAULT_CHUNK_PAGES = 10
DEFAULT_WORKERS = 4
DEFAULT_HEDGE_SECONDS = 15.0
MAX_SUBMITS_PER_CHUNK = 3
POLL_SECONDS = 1.0
RAW_DIR_NAME = "paddle_raw_chunks"
MANIFEST_FILE_NAME = "chunks.json"


def chunk_pages() -> int:
    """每片几页；0 是不切（整份一个任务，照样流式公布）。"""
    raw = str(os.environ.get(CHUNK_PAGES_ENV, "") or "").strip()
    try:
        value = int(raw) if raw else DEFAULT_CHUNK_PAGES
    except ValueError:
        value = DEFAULT_CHUNK_PAGES
    return max(0, value)


def _env_number(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, "") or default)
    except ValueError:
        return default


@dataclass
class _Chunk:
    index: int
    start: int
    end: int
    path: Path
    jobs: list[tuple[str, float]] = field(default_factory=list)  # (job_id, 提交时刻)
    submits: int = 0
    hedged: bool = False
    progressed: bool = False
    payload: dict | None = None

    @property
    def pages(self) -> int:
        return self.end - self.start


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _chunk_result_path(raw_dir: Path, chunk: _Chunk) -> Path:
    return raw_dir / f"chunk-{chunk.index:03d}-{chunk.start + 1}-{chunk.end}.json"


def _complete(payload: object, pages: int) -> bool:
    return isinstance(payload, dict) and len(payload.get("layoutParsingResults") or []) == pages


def _max_id(payload: dict, key: str) -> int:
    values = [
        block.get(key)
        for page in payload.get("layoutParsingResults") or []
        for block in ((page or {}).get("prunedResult") or {}).get("parsing_res_list") or []
        if isinstance(block.get(key), int)
    ]
    return max(values, default=-1)


def merge_paddle_chunks(payloads: list[dict]) -> dict:
    """各片的结果拼成一份（和整份一个任务的结果同样形状）；全局编号按片加偏移，不让不同片的块撞号。"""
    layout: list = []
    pages_meta: list = []
    block_offset = group_offset = 0
    chunks_meta = []
    for payload in payloads:
        payload = json.loads(json.dumps(payload))  # 不改调用方手里的原始结果
        for page in payload.get("layoutParsingResults") or []:
            for block in ((page or {}).get("prunedResult") or {}).get("parsing_res_list") or []:
                if isinstance(block.get("global_block_id"), int):
                    block["global_block_id"] += block_offset
                if isinstance(block.get("global_group_id"), int):
                    block["global_group_id"] += group_offset
        block_offset = _max_id(payload, "global_block_id") + 1 if _max_id(payload, "global_block_id") >= 0 else block_offset
        group_offset = _max_id(payload, "global_group_id") + 1 if _max_id(payload, "global_group_id") >= 0 else group_offset
        layout.extend(payload.get("layoutParsingResults") or [])
        pages_meta.extend((payload.get("dataInfo") or {}).get("pages") or [])
        chunks_meta.append(dict(payload.get("_meta") or {}))
    first_info = dict((payloads[0].get("dataInfo") if payloads else {}) or {})
    first_info.pop("pages", None)
    return {
        "layoutParsingResults": layout,
        "dataInfo": {**first_info, "numPages": len(pages_meta), "pages": pages_meta},
        "_meta": {
            "source": "paddle_jsonl",
            "dataInfoComplete": len(pages_meta) == len(layout) and all(m.get("dataInfoComplete", True) for m in chunks_meta),
            "chunks": chunks_meta,
        },
    }


def _emit_progress(done_pages: int, total: int) -> None:
    message = f"Paddle 识别中：{done_pages}/{total} 页"
    emit_stage_progress(
        stage="ocr_processing",
        substage="paddle_chunks",
        message=message,
        stage_detail=message,
        provider="paddle",
        progress_current=done_pages,
        progress_total=total,
        payload={"progress_unit": "page"},
    )


def request_chunks(
    source_pdf: Path,
    raw_dir: Path,
    *,
    token: str,
    model: str,
    optional_payload: dict,
    base_url: str,
    pages_per_chunk: int,
    workers: int,
    hedge_seconds: float,
    on_prefix: Callable[[list[dict]], None] | None = None,
    submit=paddle_api.submit_local_file,
    query=paddle_api.query_job,
    download=paddle_api.download_jsonl_result,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> list[dict]:
    """按片提交、轮询、下载；返回按页序排好的各片结果。后面几个参数只给测试注入假接口。"""
    raw_dir.mkdir(parents=True, exist_ok=True)
    source_hash = _sha256(source_pdf)
    manifest_path = raw_dir / MANIFEST_FILE_NAME
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        manifest = {}
    reuse = manifest.get("source_sha256") == source_hash and manifest.get("chunk_pages") == pages_per_chunk
    save_json(manifest_path, {"source_sha256": source_hash, "chunk_pages": pages_per_chunk})
    chunks: list[_Chunk] = []
    with fitz.open(source_pdf) as source:
        total = source.page_count
        for index, (start, end) in enumerate(chunk_ranges(total, pages_per_chunk)):
            path = raw_dir / f"chunk-{index:03d}.pdf"
            with fitz.open() as subset:
                subset.insert_pdf(source, from_page=start, to_page=end - 1)
                subset.save(path)
            chunk = _Chunk(index=index, start=start, end=end, path=path)
            if reuse:
                try:
                    cached = json.loads(_chunk_result_path(raw_dir, chunk).read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    cached = None
                if _complete(cached, chunk.pages):
                    chunk.payload = cached
            chunks.append(chunk)
    print(
        f"paddle-chunks: pages={total} chunks={len(chunks)} cached={sum(c.payload is not None for c in chunks)} "
        f"workers={workers} hedge_after={hedge_seconds}s",
        flush=True,
    )
    published = 0

    def publish_prefix() -> None:
        nonlocal published
        prefix = 0
        while prefix < len(chunks) and chunks[prefix].payload is not None:
            prefix += 1
        if on_prefix is not None and prefix > published:
            published = prefix
            on_prefix([chunk.payload for chunk in chunks[:prefix]])

    def submit_chunk(chunk: _Chunk) -> None:
        job_id, _trace = submit(token=token, file_path=chunk.path, model=model, optional_payload=optional_payload, base_url=base_url)
        chunk.jobs.append((job_id, clock()))
        chunk.submits += 1
        print(f"paddle-chunks: chunk {chunk.start + 1}-{chunk.end} submitted job={job_id} (submit #{chunk.submits})", flush=True)

    done_pages = sum(c.pages for c in chunks if c.payload is not None)
    _emit_progress(done_pages, total)
    publish_prefix()
    waiting = [c for c in chunks if c.payload is None]
    while any(c.payload is None for c in chunks):
        active = [c for c in chunks if c.payload is None and c.jobs]
        while waiting and len(active) < workers:
            chunk = waiting.pop(0)
            submit_chunk(chunk)
            active.append(chunk)
        for chunk in active:
            for job_id, _submitted in list(chunk.jobs):
                if chunk.payload is not None:
                    break
                data = query(token=token, job_id=job_id, base_url=base_url)
                state = str(data.get("state", "") or "").strip()
                progress = dict(data.get("extractProgress") or {})
                if int(progress.get("extractedPages") or 0) > 0:
                    chunk.progressed = True
                if state == "done":
                    jsonl_url = str((data.get("resultUrl") or {}).get("jsonUrl", "") or "").strip()
                    payload = download(jsonl_url=jsonl_url) if jsonl_url else None
                    if not _complete(payload, chunk.pages):
                        raise RuntimeError(f"Paddle 第 {chunk.start + 1}-{chunk.end} 页的结果页数不对（应为 {chunk.pages} 页）")
                    chunk.payload = payload
                    chunk.jobs.clear()
                    save_json(_chunk_result_path(raw_dir, chunk), payload, compact=True)
                    done_pages += chunk.pages
                    print(f"paddle-chunks: chunk {chunk.start + 1}-{chunk.end} done job={job_id}", flush=True)
                    _emit_progress(done_pages, total)
                    publish_prefix()
                elif state == "failed":
                    chunk.jobs.remove((job_id, _submitted))
                    print(f"paddle-chunks: chunk {chunk.start + 1}-{chunk.end} job={job_id} failed: {data.get('errorMsg', '')}", flush=True)
                    if not chunk.jobs:
                        if chunk.submits >= MAX_SUBMITS_PER_CHUNK:
                            raise RuntimeError(
                                f"Paddle 第 {chunk.start + 1}-{chunk.end} 页交了 {chunk.submits} 次都失败：{data.get('errorMsg', '')}"
                            )
                        waiting.insert(0, chunk)
        # 防排队卡住：没有等着提交的片了，某片交上去很久还一页没识别，再交一份
        if not waiting:
            for chunk in chunks:
                if chunk.payload is None and chunk.jobs and not chunk.hedged and not chunk.progressed:
                    if clock() - chunk.jobs[0][1] >= hedge_seconds and chunk.submits < MAX_SUBMITS_PER_CHUNK:
                        chunk.hedged = True
                        print(f"paddle-chunks: chunk {chunk.start + 1}-{chunk.end} still queued after {hedge_seconds}s; submitting again", flush=True)
                        submit_chunk(chunk)
        if any(c.payload is None for c in chunks):
            sleep(POLL_SECONDS)
    return [chunk.payload for chunk in chunks]


def run_paddle_chunked_to_job_dir(args: SimpleNamespace, *, api=None) -> tuple[Path, Path, Path, Path]:
    """返回值和 `paddle_runner.run_paddle_to_job_dir` 一样：(任务目录, 原文, 原始结果, 归一化文档)。`api` 只给测试注入假接口。"""
    token = paddle_api.get_paddle_token(explicit_value=getattr(args, "paddle_token", ""))
    if not token:
        raise RuntimeError("Missing Paddle token. Set RETAIN_PADDLE_API_TOKEN or backend/pipeline/.env/paddle.env.")
    job_dirs = job_dirs_from_explicit_args(args)
    job_dirs.source_dir.mkdir(parents=True, exist_ok=True)
    source_pdf = prepare_source_pdf(args, job_dirs.source_dir)
    model = paddle_api.normalize_model_name(getattr(args, "paddle_model", ""))
    optional_payload = paddle_api.build_optional_payload(getattr(args, "paddle_model", ""))
    base_url = str(getattr(args, "paddle_api_url", "") or "").strip() or paddle_api.PADDLE_BASE_URL
    provider_result_json_path = job_dirs.ocr_dir / "result.json"
    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    normalized_report_json_path = normalized_json_path.with_name(DOCUMENT_SCHEMA_REPORT_FILE_NAME)
    with fitz.open(source_pdf) as source:
        total_pages = source.page_count
    stream = OcrStreamWriter(job_dirs.ocr_dir, provider="paddle", total_pages=total_pages)

    def publish(prefix_payloads: list[dict]) -> None:
        document, _report = build_normalized_document_for_paddle(
            provider_result_json_path=provider_result_json_path,
            source_pdf_path=source_pdf,
            document_id=job_dirs.root.name,
            provider_version=model,
            provider_payload=merge_paddle_chunks(prefix_payloads),
        )
        stream.publish(document)

    api_kwargs = dict(api or {})
    try:
        payloads = request_chunks(
            source_pdf,
            job_dirs.ocr_dir / RAW_DIR_NAME,
            token=token,
            model=model,
            optional_payload=optional_payload,
            base_url=base_url,
            pages_per_chunk=chunk_pages() or total_pages,
            workers=max(1, int(_env_number(WORKERS_ENV, DEFAULT_WORKERS))),
            hedge_seconds=_env_number(HEDGE_SECONDS_ENV, DEFAULT_HEDGE_SECONDS),
            on_prefix=publish,
            **api_kwargs,
        )
        payload = merge_paddle_chunks(payloads)
        payload["_meta"]["provider"] = "paddle"
        payload["_meta"]["transport"] = "official_http_chunked"
        save_json(provider_result_json_path, payload, compact=True)
        markdown_path = materialize_paddle_markdown_artifacts(payload=payload, job_root=job_dirs.root)
        if markdown_path is not None:
            print(f"published markdown: {markdown_path}", flush=True)
        save_normalized_document_for_paddle(
            provider_result_json_path=provider_result_json_path,
            source_pdf_path=source_pdf,
            normalized_json_path=normalized_json_path,
            normalized_report_json_path=normalized_report_json_path,
            document_id=job_dirs.root.name,
            provider_version=model,
            provider_payload=payload,
        )
        stream.publish(json.loads(normalized_json_path.read_text(encoding="utf-8")), done=True)
    except BaseException as error:
        stream.fail(f"{type(error).__name__}: {str(error).splitlines()[0] if str(error) else ''}")
        raise
    print(f"job dir: {job_dirs.root}", flush=True)
    return job_dirs.root, source_pdf, provider_result_json_path, normalized_json_path


__all__ = [
    "chunk_pages",
    "merge_paddle_chunks",
    "request_chunks",
    "run_paddle_chunked_to_job_dir",
]
