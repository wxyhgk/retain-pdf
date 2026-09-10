from __future__ import annotations
from contextlib import contextmanager
import json
import os
from pathlib import Path
import signal
import threading
import time
from retainpdf_pipeline.translate.llm.shared.executor_context import execution_enabled, unit_scope

import fitz

from retainpdf_pipeline.translate.prompt_loader import load_prompt

from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_transition
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.llm.shared.structured_models import DOMAIN_CONTEXT_RESPONSE_SCHEMA
from retainpdf_pipeline.translate.llm.shared.structured_parsers import parse_domain_context_response


DOMAIN_CONTEXT_FILE_NAME = "domain-context.json"
DOMAIN_CONTEXT_RAW_FILE_NAME = "domain-context.raw.txt"
DOMAIN_CONTEXT_REQUEST_TIMEOUT_SECS = 60
DOMAIN_CONTEXT_TOTAL_TIMEOUT_ENV = "RETAIN_TRANSLATION_DOMAIN_CONTEXT_TOTAL_TIMEOUT"
DOMAIN_CONTEXT_TOTAL_TIMEOUT_SECS = 90


class DomainContextTimeoutError(TimeoutError):
    pass


@contextmanager
def _domain_context_deadline(timeout_secs: int):
    if execution_enabled():
        # Do not interrupt receipt polling while Rust may still be generating.
        with unit_scope("domain", ["document-preview"]):
            yield
        return
    if timeout_secs <= 0 or threading.current_thread() is not threading.main_thread():
        yield
        return
    previous_handler = signal.getsignal(signal.SIGALRM)
    previous_timer = signal.setitimer(signal.ITIMER_REAL, 0)

    def _handle_timeout(signum, frame):  # noqa: ANN001
        del signum, frame
        raise DomainContextTimeoutError(f"domain inference exceeded {timeout_secs}s")

    signal.signal(signal.SIGALRM, _handle_timeout)
    signal.setitimer(signal.ITIMER_REAL, float(timeout_secs))
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)
        if previous_timer[0] > 0:
            signal.setitimer(signal.ITIMER_REAL, previous_timer[0], previous_timer[1])


def _empty_domain_context(preview_text: str = "") -> dict[str, str]:
    return {
        "domain": "",
        "summary": "",
        "translation_guidance": "",
        "preview_text": preview_text,
    }


def _domain_context_total_timeout() -> int:
    raw = os.environ.get(DOMAIN_CONTEXT_TOTAL_TIMEOUT_ENV, "").strip()
    if not raw:
        return DOMAIN_CONTEXT_TOTAL_TIMEOUT_SECS
    try:
        return max(1, int(raw))
    except ValueError:
        return DOMAIN_CONTEXT_TOTAL_TIMEOUT_SECS


def extract_pdf_preview_text(source_pdf_path: Path, max_pages: int = 2) -> str:
    doc = fitz.open(source_pdf_path)
    try:
        parts: list[str] = []
        for page_idx in range(min(max_pages, len(doc))):
            page = doc[page_idx]
            text = page.get_text("text").strip()
            if text:
                parts.append(f"[Page {page_idx + 1}]\n{text}")
        return "\n\n".join(parts).strip()
    finally:
        doc.close()


def build_domain_inference_messages(preview_text: str) -> list[dict[str, str]]:
    user_payload = {
        "task": load_prompt("domain_inference_task.txt"),
        "preview_text": preview_text,
    }
    return [
        {"role": "system", "content": load_prompt("domain_inference_system.txt")},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def load_cached_domain_context(output_dir: Path | None) -> dict[str, str] | None:
    if output_dir is None:
        return None
    path = output_dir / DOMAIN_CONTEXT_FILE_NAME
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    return {
        "domain": str(payload.get("domain", "")).strip(),
        "summary": str(payload.get("summary", "")).strip(),
        "translation_guidance": str(payload.get("translation_guidance", "")).strip(),
        "preview_text": str(payload.get("preview_text", "") or ""),
    }


def _shared_domain_context_path(preview_text: str, *, model: str) -> Path:
    import hashlib

    from retainpdf_pipeline.foundation.config.paths import DOMAIN_CONTEXT_CACHE_DIR

    key = hashlib.sha256(f"{model}\n{preview_text.strip()}".encode("utf-8")).hexdigest()
    return DOMAIN_CONTEXT_CACHE_DIR / f"{key}.json"


def _load_shared_domain_context(preview_text: str, *, model: str) -> dict[str, str] | None:
    # 按内容寻址的跨任务缓存:同一文档换个任务目录重跑,不必重付
    # 4-5s 的领域识别调用(原有的 per-job 缓存只在同一任务目录内生效)。
    path = _shared_domain_context_path(preview_text, model=model)
    try:
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    result = {
        "domain": str(payload.get("domain", "")).strip(),
        "summary": str(payload.get("summary", "")).strip(),
        "translation_guidance": str(payload.get("translation_guidance", "")).strip(),
        "preview_text": str(payload.get("preview_text", "") or ""),
    }
    if not (result["summary"] or result["translation_guidance"]):
        return None
    return result


def _store_shared_domain_context(preview_text: str, *, model: str, context: dict[str, str]) -> None:
    if not (str(context.get("summary", "") or "").strip() or str(context.get("translation_guidance", "") or "").strip()):
        return
    path = _shared_domain_context_path(preview_text, model=model)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_suffix(f".{os.getpid()}.tmp")
        temp_path.write_text(json.dumps(context, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temp_path, path)
    except Exception:
        return


def infer_domain_context_from_preview_text(
    *,
    preview_text: str,
    api_key: str,
    model: str,
    base_url: str,
    output_dir: Path | None = None,
) -> dict[str, str]:
    if not preview_text:
        result = _empty_domain_context("")
        if output_dir is not None:
            save_domain_context(output_dir, result)
        return result
    cached = load_cached_domain_context(output_dir)
    if cached is not None and str(cached.get("preview_text", "") or "").strip() == preview_text.strip():
        print("domain-infer: cache hit", flush=True)
        return cached
    shared_cached = _load_shared_domain_context(preview_text, model=model)
    if shared_cached is not None:
        print("domain-infer: shared cache hit", flush=True)
        if output_dir is not None:
            save_domain_context(output_dir, shared_cached)
        return shared_cached

    messages = build_domain_inference_messages(preview_text)
    total_timeout = _domain_context_total_timeout()
    started = time.perf_counter()
    emit_stage_transition(
        stage="domain_inference",
        substage="domain_inference",
        message="开始识别文档领域",
        progress_current=0,
        progress_total=1,
        payload={
            "user_stage": "translation",
            "progress_unit": "step",
        },
    )
    try:
        with _domain_context_deadline(total_timeout):
            content = request_chat_content(
                messages,
                api_key=api_key,
                model=model,
                base_url=base_url,
                temperature=0.0,
                response_format=DOMAIN_CONTEXT_RESPONSE_SCHEMA,
                timeout=min(DOMAIN_CONTEXT_REQUEST_TIMEOUT_SECS, total_timeout),
                request_label="domain-infer",
                max_attempts=1,
            )
    except DomainContextTimeoutError:
        elapsed_ms = int(round((time.perf_counter() - started) * 1000))
        result = _empty_domain_context(preview_text)
        if output_dir is not None:
            save_domain_context(output_dir, result)
        print(
            f"domain-infer: total timeout after {elapsed_ms / 1000:.2f}s, skipped",
            flush=True,
        )
        emit_stage_progress(
            stage="domain_inference",
            substage="domain_inference",
            message="领域识别超时，使用默认翻译上下文",
            progress_current=1,
            progress_total=1,
            elapsed_ms=elapsed_ms,
            payload={
                "user_stage": "translation",
                "progress_unit": "step",
                "timed_out": True,
                "timeout_s": total_timeout,
            },
        )
        return result
    try:
        result = parse_domain_context_response(content, preview_text=preview_text)
    except Exception:
        if output_dir is not None:
            save_domain_context_raw(output_dir, content)
        raise
    if output_dir is not None:
        save_domain_context(output_dir, result)
    _store_shared_domain_context(preview_text, model=model, context=result)
    emit_stage_progress(
        stage="domain_inference",
        substage="domain_inference",
        message="文档领域识别完成",
        progress_current=1,
        progress_total=1,
        elapsed_ms=int(round((time.perf_counter() - started) * 1000)),
        payload={
            "user_stage": "translation",
            "progress_unit": "step",
        },
    )
    return result


def infer_domain_context(
    *,
    source_pdf_path: Path | None,
    api_key: str,
    model: str,
    base_url: str,
    preview_text_fallback: str = "",
    output_dir: Path | None = None,
) -> dict[str, str]:
    preview_text = extract_pdf_preview_text(source_pdf_path, max_pages=2) if source_pdf_path is not None else ""
    if not preview_text:
        preview_text = preview_text_fallback.strip()
    return infer_domain_context_from_preview_text(
        preview_text=preview_text,
        api_key=api_key,
        model=model,
        base_url=base_url,
        output_dir=output_dir,
    )


def save_domain_context(output_dir: Path, context: dict[str, str]) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / DOMAIN_CONTEXT_FILE_NAME
    path.write_text(json.dumps(context, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def save_domain_context_raw(output_dir: Path, content: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / DOMAIN_CONTEXT_RAW_FILE_NAME
    path.write_text(content or "", encoding="utf-8")
    return path
