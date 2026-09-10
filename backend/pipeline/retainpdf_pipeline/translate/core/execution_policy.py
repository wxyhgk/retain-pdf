"""Transport selection and local policy only; no clients, runtime or scheduling imports."""
import os
import re


class ExecutorError(RuntimeError):
    """Safe executor error; kept re-exported from the historic client module."""


def execution_enabled():
    value = os.environ.get("RETAIN_TRANSLATION_TRANSPORT", "legacy").strip()
    if value not in {"legacy", "rust"}:
        raise ExecutorError("unsupported translation transport; direct fallback is disabled")
    return value == "rust"


def strategy():
    if not execution_enabled():
        return "baseline"
    value = os.environ.get("RETAIN_TRANSLATION_OPTIMIZATION", "baseline")
    if value not in {"baseline", "page_local_v1"}:
        raise ValueError("unsupported translation optimization strategy")
    return value


def is_standalone_number(item):
    if strategy() != "page_local_v1":
        return False
    if (item.get("continuation_group") or item.get("translation_group_id") or item.get("translation_unit_kind") == "group"
            or str(item.get("translation_unit_id", "")).startswith("__cg__:")
            or len(item.get("translation_unit_member_ids") or []) > 1
            or any(item.get(key) for key in ("formula_map", "protected_map", "translation_unit_formula_map",
                                             "translation_unit_protected_map", "group_formula_map", "group_protected_map"))):
        return False
    source = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or item.get("source_text") or "").strip()
    return re.fullmatch(r"(?:[0-9]+\.?|\([0-9]+\)|\[[0-9]+\])", source) is not None
