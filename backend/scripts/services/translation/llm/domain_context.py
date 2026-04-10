from __future__ import annotations
import json
from pathlib import Path

import fitz

from foundation.shared.prompt_loader import load_prompt

from .deepseek_client import request_chat_content
from .structured_models import DOMAIN_CONTEXT_RESPONSE_SCHEMA
from .structured_parsers import parse_domain_context_response


DOMAIN_CONTEXT_FILE_NAME = "domain-context.json"
DOMAIN_CONTEXT_RAW_FILE_NAME = "domain-context.raw.txt"


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


def infer_domain_context_from_preview_text(
    *,
    preview_text: str,
    api_key: str,
    model: str,
    base_url: str,
    output_dir: Path | None = None,
) -> dict[str, str]:
    if not preview_text:
        result = {
            "domain": "",
            "summary": "",
            "translation_guidance": "",
            "preview_text": "",
        }
        if output_dir is not None:
            save_domain_context(output_dir, result)
        return result
    cached = load_cached_domain_context(output_dir)
    if cached is not None and str(cached.get("preview_text", "") or "").strip() == preview_text.strip():
        print("domain-infer: cache hit", flush=True)
        return cached

    content = request_chat_content(
        build_domain_inference_messages(preview_text),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=DOMAIN_CONTEXT_RESPONSE_SCHEMA,
        timeout=120,
        request_label="domain-infer",
    )
    try:
        result = parse_domain_context_response(content, preview_text=preview_text)
    except Exception:
        if output_dir is not None:
            save_domain_context_raw(output_dir, content)
        raise
    if output_dir is not None:
        save_domain_context(output_dir, result)
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
