"""目录页认上下文（R2，2026-11-28）：翻译开始前，规则拿不准的目录页交目录 agent 核对条目归属和每段字的角色。

挂在 ``translation.toc = agent`` 下面，子开关 ``RETAINPDF_TOC_CONTEXT``（环境变量，R4 定默认时再进任务参数）：

- ``off``（默认）：不跑，和以前一样；
- ``rules``：只算「拿不准」的信号，记在 ``translated/toc-context.v1.json``（会问哪几页），不发请求、不改文档；
- ``model``：拿不准的页截图问模型（R3 Haiku 实测前不开），改过的写回归一化文档（重建这一页的条目块，原位替换照它擦字写字），
  文档里记 ``derived.toc_context``，续跑不再改第二遍。

只改本任务自己的文档（``source_json`` 在任务目录里）；跟着 OCR 翻（``ocr_stream_dir``）时文档还没出全，不跑。
出任何错只打日志，照常翻译。方案见 docs/ops/planning/toc-agent/20261128-R2：认上下文的agent.md。
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Callable

CONTEXT_ENV = "RETAINPDF_TOC_CONTEXT"
DERIVED_KEY = "toc_context"
HEADING_ROLES = frozenset({"heading", "document_title"})


def context_mode_from_env() -> str:
    from retainpdf_toc_agent_engine import normalize_context_mode

    return normalize_context_mode(os.environ.get(CONTEXT_ENV, ""))


def _heading_texts(document: dict, toc_pages: set[int]) -> list[str]:
    texts = []
    for page_index, page in enumerate(document.get("pages") or []):
        if page_index in toc_pages:
            continue
        for block in page.get("blocks") or []:
            if str(block.get("structure_role") or "") in HEADING_ROLES:
                content = block.get("content") if isinstance(block.get("content"), dict) else {}
                text = " ".join(str(content.get("text") or block.get("text") or "").split())
                if text:
                    texts.append(text)
    return texts


def run_toc_context(
    *,
    toc_mode: str,
    source_json_path: Path,
    source_pdf_path: Path | None,
    output_dir: Path,
    api_key: str,
    model: str,
    base_url: str,
    context_mode: str | None = None,
    ocr_stream_dir: Path | None = None,
    chat_fn: Callable[..., Any] | None = None,  # 测试注入
) -> dict:
    """跑一遍认上下文，回摘要（``status`` 和各页统计）。不抛。"""
    from retainpdf_pipeline.translate.toc_stage import normalize_toc_mode

    mode = context_mode if context_mode is not None else context_mode_from_env()
    if normalize_toc_mode(toc_mode) != "agent" or mode not in ("rules", "model"):
        return {"status": "off"}
    if ocr_stream_dir is not None:
        print("toc context: skipped while following the OCR stream", flush=True)
        return {"status": "skipped_ocr_stream"}
    if source_pdf_path is None or not Path(source_pdf_path).is_file() or not Path(source_json_path).is_file():
        return {"status": "skipped_no_source"}
    try:
        return _run(mode=mode, source_json_path=Path(source_json_path), source_pdf_path=Path(source_pdf_path),
                    output_dir=Path(output_dir), api_key=api_key, model=model, base_url=base_url, chat_fn=chat_fn)
    except Exception as error:  # noqa: BLE001 - 认上下文失败照常翻译
        print(f"toc context: failed, translating as before ({type(error).__name__}: {error})"[:500], flush=True)
        return {"status": "failed", "error": f"{type(error).__name__}: {error}"[:500]}


def _run(*, mode: str, source_json_path: Path, source_pdf_path: Path, output_dir: Path, api_key: str, model: str,
         base_url: str, chat_fn: Callable[..., Any] | None) -> dict:
    import fitz
    from retainpdf_base.io import save_json_atomic
    from retainpdf_toc_agent_engine import toc_chat_fn
    from retainpdf_toc_agent_engine import toc_context
    from retainpdf_toc_agent_engine.context import summarize

    from retainpdf_pipeline.ocr.document_schema.toc_pages import apply_toc_context
    from retainpdf_pipeline.ocr.document_schema.toc_pages import context_drafts

    document = json.loads(source_json_path.read_text(encoding="utf-8"))
    if (document.get("derived") or {}).get(DERIVED_KEY):
        return {"status": "already_applied"}
    with fitz.open(source_pdf_path) as pdf:
        drafts, no_text_pages = context_drafts(document, pdf)
        if not drafts:
            return {"status": "no_toc", "no_text_pages": no_text_pages}
        if mode == "model" and chat_fn is None:
            chat_fn = toc_chat_fn(model=model, base_url=base_url, api_key=api_key)
        toc_pages = {int(draft["page_index"]) for draft in drafts}
        outcomes = toc_context(
            drafts,
            pdf=pdf,
            output_dir=output_dir,
            mode=mode,
            chat_fn=chat_fn if mode == "model" else None,
            model_identity={"model": model, "base_url": base_url},
            heading_texts=_heading_texts(document, toc_pages),
        )
    summary = {"status": "done", "mode": mode, "no_text_pages": no_text_pages, **summarize(outcomes)}
    if mode != "model":
        return summary
    job_root = output_dir.resolve().parent
    if not source_json_path.resolve().is_relative_to(job_root):
        print("toc context: document belongs to another job, not writing back", flush=True)
        summary["written"] = 0
        return summary
    changed = apply_toc_context(document, [outcome.to_record() for outcome in outcomes])
    summary["written"] = changed
    if changed:
        document.setdefault("derived", {})[DERIVED_KEY] = {
            "pages_changed": changed,
            "result_file": f"{output_dir.name}/toc-context.v1.json",
        }
        save_json_atomic(source_json_path, document, compact=True)
        print(f"toc context: rewrote {changed} contents blocks in {source_json_path.name}", flush=True)
    return summary


__all__ = ["CONTEXT_ENV", "context_mode_from_env", "run_toc_context"]
