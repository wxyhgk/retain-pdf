from __future__ import annotations

import json
import re
from typing import Any

from .deepseek_client import extract_json_text


_TRAILING_COMMA_RE = re.compile(r",(\s*[}\]])")
_FENCED_JSON_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_UNQUOTED_KEY_RE = re.compile(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)(\s*:)')
_LINE_VALUE_RE = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_\-]*)\s*:\s*(.+?)\s*$")


def parse_structured_json(content: str) -> dict[str, Any]:
    try:
        payload = json.loads(extract_json_text(content))
    except Exception:
        try:
            repaired = _repair_json_text(content)
            payload = json.loads(repaired)
        except Exception:
            payload = _parse_key_value_lines(content)
    if not isinstance(payload, dict):
        raise ValueError("Structured response is not a JSON object.")
    return payload


def extract_string_fields(content: str, aliases_by_field: dict[str, tuple[str, ...] | list[str]]) -> dict[str, str]:
    text = _strip_code_fences(content)
    result: dict[str, str] = {}
    for field_name, aliases in aliases_by_field.items():
        for alias in aliases:
            value = _extract_string_field(text, alias)
            if value:
                result[field_name] = value
                break
    return result


def _repair_json_text(content: str) -> str:
    text = _strip_code_fences(content)
    try:
        text = extract_json_text(text)
    except Exception:
        text = _slice_outer_json_object(text)
    text = _CONTROL_CHAR_RE.sub("", text)
    text = _UNQUOTED_KEY_RE.sub(r'\1"\2"\3', text)
    repaired = _TRAILING_COMMA_RE.sub(r"\1", text)
    return repaired


def _strip_code_fences(content: str) -> str:
    return _FENCED_JSON_RE.sub("", (content or "").strip()).strip()


def _slice_outer_json_object(content: str) -> str:
    text = (content or "").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Structured response does not contain a JSON object.")
    return text[start : end + 1]


def _parse_key_value_lines(content: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for raw_line in _strip_code_fences(content).splitlines():
        match = _LINE_VALUE_RE.match(raw_line)
        if not match:
            continue
        key = str(match.group(1) or "").strip()
        value = str(match.group(2) or "").strip().strip('",')
        if key:
            result[key] = value
    if not result:
        raise ValueError("Structured response could not be repaired.")
    return result


def _extract_string_field(content: str, key: str) -> str:
    escaped_key = re.escape(key)
    patterns = (
        re.compile(rf'["\']{escaped_key}["\']\s*:\s*"((?:\\.|[^"\\])*)"', re.DOTALL),
        re.compile(rf'["\']{escaped_key}["\']\s*:\s*\'((?:\\.|[^\'\\])*)\'', re.DOTALL),
        re.compile(rf'^\s*{escaped_key}\s*:\s*(.+?)\s*$', re.IGNORECASE | re.MULTILINE),
        re.compile(rf'^\s*["\']{escaped_key}["\']\s*:\s*(.+?)\s*$', re.IGNORECASE | re.MULTILINE),
    )
    for idx, pattern in enumerate(patterns):
        match = pattern.search(content)
        if not match:
            continue
        value = str(match.group(1) or "").strip()
        if not value:
            continue
        if idx == 0:
            try:
                return json.loads(f'"{value}"').strip()
            except Exception:
                return value.strip()
        if idx == 1:
            return _decode_single_quoted_string(value).strip()
        cleaned = value.strip().strip('",\'')
        if cleaned:
            return cleaned
    return ""


def _decode_single_quoted_string(value: str) -> str:
    escaped = value.replace("\\'", "'").replace("\\\\", "\\")
    return escaped
