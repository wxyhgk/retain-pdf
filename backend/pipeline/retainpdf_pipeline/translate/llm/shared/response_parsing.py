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
    # 先原样试：合法 JSON 的字符串里本来就可能有弯引号和全角冒号（「Vue’s」「“效应”」「注：」），
    # 一律替换会把好好的 JSON 改坏——风格指南、术语预扫、组成员解析曾因此大量失败。
    # 原样解析不了，才当成「模型用弯引号 / 全角冒号写了 JSON 结构」去替换。
    verbatim = _verbatim_json_object(text)
    if verbatim is not None:
        return verbatim
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


def _verbatim_json_object(text: str) -> str | None:
    """最外层 ``{...}`` 原样能解析（含补 LaTeX 反斜杠之后）就返回它，否则 None。"""
    from retainpdf_pipeline.translate.llm.shared.structured_output import escape_latex_backslashes

    # 漏了最外层花括号、以 "translations": 开头的回复要先补花括号，不能把里面某一项当成整体。
    if _JSON_KEY_PREFIX_RE.match((text or "").strip().translate(_JSON_QUOTE_TRANSLATION)):
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end < start:
        return None
    candidate = text[start : end + 1]
    for attempt in (candidate, escape_latex_backslashes(candidate)):
        try:
            json.loads(attempt)
        except (ValueError, TypeError):
            continue
        return candidate
    return None


def _normalize_loose_json_text(text: str) -> str:
    normalized = (text or "").strip().translate(_JSON_QUOTE_TRANSLATION).strip()
    if _JSON_KEY_PREFIX_RE.match(normalized):
        normalized = "{" + normalized + "}"
    return normalized
