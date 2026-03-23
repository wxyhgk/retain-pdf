import json
from pathlib import Path

import fitz

from common.prompt_loader import load_prompt

from .deepseek_client import extract_json_text
from .deepseek_client import request_chat_content


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

    content = request_chat_content(
        build_domain_inference_messages(preview_text),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format={"type": "json_object"},
        timeout=120,
        request_label="domain-infer",
    )
    payload = json.loads(extract_json_text(content))
    result = {
        "domain": str(payload.get("domain", "")).strip(),
        "summary": str(payload.get("summary", "")).strip(),
        "translation_guidance": str(payload.get("translation_guidance", "")).strip(),
        "preview_text": preview_text,
    }
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
    path = output_dir / "domain-context.json"
    path.write_text(json.dumps(context, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
