from __future__ import annotations

import re
from typing import Any

from common import count_math_spans


def _vars(context: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(context, dict):
        return {}
    vars_payload = context.get("vars")
    return vars_payload if isinstance(vars_payload, dict) else {}


def _text(output: Any) -> str:
    if isinstance(output, str):
        return output
    if output is None:
        return ""
    return str(output)


def _pass(reason: str = "ok") -> dict[str, Any]:
    return {"pass": True, "score": 1, "reason": reason}


def _fail(reason: str) -> dict[str, Any]:
    return {"pass": False, "score": 0, "reason": reason}


def check_min_output_length(output: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    minimum = vars_payload.get("min_output_chars")
    if minimum in (None, ""):
        return _pass("min_output_chars not set")
    text = _text(output).strip()
    if len(text) >= int(minimum):
        return _pass(f"output length {len(text)} >= {minimum}")
    return _fail(f"output length {len(text)} < {minimum}")


def check_cjk_if_required(output: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    if not vars_payload.get("require_cjk"):
        return _pass("require_cjk disabled")
    text = _text(output)
    cjk_chars = len(re.findall(r"[\u3400-\u4dbf\u4e00-\u9fff]", text))
    minimum = int(vars_payload.get("min_cjk_chars") or 1)
    if cjk_chars >= minimum:
        return _pass(f"cjk chars {cjk_chars} >= {minimum}")
    return _fail(f"cjk chars {cjk_chars} < {minimum}")


def check_expected_contains(output: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    expected = [str(value or "") for value in (vars_payload.get("expected_contains") or []) if str(value or "").strip()]
    if not expected:
        return _pass("expected_contains empty")
    text = _text(output)
    missing = [value for value in expected if value not in text]
    if not missing:
        return _pass("all expected substrings found")
    return _fail(f"missing expected substrings: {missing}")


def check_required_terms(output: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    required = [str(value or "") for value in (vars_payload.get("required_terms") or []) if str(value or "").strip()]
    if not required:
        return _pass("required_terms empty")
    text = _text(output)
    missing = [value for value in required if value not in text]
    if not missing:
        return _pass("all required terms preserved")
    return _fail(f"missing required terms: {missing}")


def check_forbidden_substrings(output: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    forbidden = [str(value or "") for value in (vars_payload.get("forbidden_substrings") or []) if str(value or "").strip()]
    if not forbidden:
        return _pass("forbidden_substrings empty")
    text = _text(output)
    hits = [value for value in forbidden if value in text]
    if not hits:
        return _pass("no forbidden substrings found")
    return _fail(f"forbidden substrings found: {hits}")


def check_math_delimiters(output: Any, context: dict[str, Any] | None = None) -> dict[str, Any]:
    vars_payload = _vars(context)
    expected_inline = vars_payload.get("expected_inline_math_count")
    expected_block = vars_payload.get("expected_block_math_count")
    if expected_inline in (None, "") and expected_block in (None, ""):
        return _pass("math expectations empty")
    inline_count, block_count = count_math_spans(_text(output))
    if expected_inline not in (None, "") and inline_count != int(expected_inline):
        return _fail(f"inline math count {inline_count} != {expected_inline}")
    if expected_block not in (None, "") and block_count != int(expected_block):
        return _fail(f"block math count {block_count} != {expected_block}")
    return _pass("math delimiter counts match")

