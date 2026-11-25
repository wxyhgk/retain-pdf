"""ACP 的内容块 ↔ 模型消息（OpenAI Chat 的写法：字符串，或 text / image_url 片段列表；接线那边再换成各协议的写法）。"""
from __future__ import annotations

from typing import Any

IMAGE_MIME_TYPES = ("image/png", "image/jpeg", "image/webp", "image/gif")


def _text_part(text: str) -> dict[str, Any]:
    return {"type": "text", "text": text}


def prompt_to_content(prompt: list[Any]) -> list[dict[str, Any]]:
    """`session/prompt` 的 `prompt`（ContentBlock 数组）→ 一条用户消息的片段列表。不认识的块跳过。"""
    parts: list[dict[str, Any]] = []
    for block in prompt or []:
        if not isinstance(block, dict):
            continue
        kind = block.get("type")
        if kind == "text" and str(block.get("text") or "").strip():
            parts.append(_text_part(str(block["text"])))
        elif kind == "image" and block.get("data") and block.get("mimeType") in IMAGE_MIME_TYPES:
            parts.append({"type": "image_url", "image_url": {"url": f"data:{block['mimeType']};base64,{block['data']}"}})
        elif kind == "resource" and isinstance(block.get("resource"), dict):
            resource = block["resource"]
            text = str(resource.get("text") or "")
            if text.strip():
                parts.append(_text_part(f"【附：{resource.get('uri') or '资料'}】\n{text}"))
        elif kind == "resource_link" and block.get("uri"):
            label = block.get("title") or block.get("name") or ""
            parts.append(_text_part(f"【引用：{label} {block['uri']}】".replace("  ", " ")))
    return parts


def text_only(parts: list[dict[str, Any]]) -> str:
    return "\n\n".join(str(part.get("text") or "") for part in parts if part.get("type") == "text")


__all__ = ["IMAGE_MIME_TYPES", "prompt_to_content", "text_only"]
