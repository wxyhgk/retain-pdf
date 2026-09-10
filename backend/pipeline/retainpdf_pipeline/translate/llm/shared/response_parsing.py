from __future__ import annotations

import json
import re


_JSON_QUOTE_TRANSLATION = str.maketrans(
    {
        "“": '"',
        "”": '"',
        "„": '"',
        "‟": '"',
        "‘": '"',
        "’": '"',
        "‚": '"',
        "‛": '"',
        "：": ":",
    }
)
_JSON_KEY_PREFIX_RE = re.compile(r'^\s*"translations"\s*:', re.DOTALL)
_TAGGED_ITEM_BLOCK_RE = re.compile(
    r"<<<ITEM\s+item_id=(?P<item_id>[^\s>]+)(?:\s+decision=(?P<decision>[A-Za-z_-]+))?\s*>>>\s*"
    r"(?P<content>.*?)"
    r"\s*<<<END>>>",
    re.DOTALL,
)
_PROTOCOL_SHELL_HINT_RE = re.compile(
    r"(translated_text|translations|item_id|decision|```json|<<<ITEM)",
    re.IGNORECASE,
)


def extract_json_text(content: str) -> str:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    text = _normalize_loose_json_text(text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Model response does not contain a JSON object.")
    return text[start : end + 1]


def extract_single_item_translation_text(content: str, item_id: str) -> str:
    text = (content or "").strip()
    if not text:
        return ""

    tagged_matches = list(_TAGGED_ITEM_BLOCK_RE.finditer(text))
    if tagged_matches:
        for match in tagged_matches:
            if (match.group("item_id") or "").strip() == item_id:
                return (match.group("content") or "").strip()
        if len(tagged_matches) == 1:
            return (tagged_matches[0].group("content") or "").strip()

    try:
        payload = json.loads(extract_json_text(text))
    except Exception:
        if _PROTOCOL_SHELL_HINT_RE.search(text):
            raise
        return text

    if isinstance(payload, dict) and "translated_text" in payload:
        return unwrap_translation_shell(str(payload.get("translated_text", "") or "").strip(), item_id=item_id)

    translations = payload.get("translations", [])
    if not isinstance(translations, list):
        return text
    for item in translations:
        if str(item.get("item_id", "") or "").strip() == item_id:
            return unwrap_translation_shell(str(item.get("translated_text", "") or "").strip(), item_id=item_id)
    if len(translations) == 1:
        return unwrap_translation_shell(str(translations[0].get("translated_text", "") or "").strip(), item_id=item_id)
    return text


def unwrap_translation_shell(text: str, item_id: str = "") -> str:
    current = str(text or "").strip()
    for _ in range(3):
        if not current or "translated_text" not in current or "{" not in current:
            return current
        try:
            payload = json.loads(extract_json_text(current))
        except Exception:
            return current
        if isinstance(payload, dict):
            if "translated_text" in payload:
                next_text = str(payload.get("translated_text", "") or "").strip()
                if next_text == current:
                    return current
                current = next_text
                continue
            translations = payload.get("translations", [])
            if isinstance(translations, list):
                for item in translations:
                    if not isinstance(item, dict):
                        continue
                    if item_id and str(item.get("item_id", "") or "").strip() == item_id:
                        next_text = str(item.get("translated_text", "") or "").strip()
                        if next_text == current:
                            return current
                        current = next_text
                        break
                else:
                    if len(translations) != 1 or not isinstance(translations[0], dict):
                        return current
                    next_text = str(translations[0].get("translated_text", "") or "").strip()
                    if next_text == current:
                        return current
                    current = next_text
                continue
        return current
    return current


def _normalize_loose_json_text(text: str) -> str:
    normalized = (text or "").strip().translate(_JSON_QUOTE_TRANSLATION).strip()
    if _JSON_KEY_PREFIX_RE.match(normalized):
        normalized = "{" + normalized + "}"
    return normalized
