from retainpdf_translation.core.payload.parts.common import is_group_unit_id
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


def is_isolated_single_unit(item):
    """本块自己就是一个完整翻译单元：不在续段组里、没有公式 / 受保护片段。

    续段组成员只是整段的一截，不能单独给译文或单独保留原文。
    """
    return not (item.get("continuation_group") or item.get("translation_group_id") or item.get("translation_unit_kind") == "group"
                or is_group_unit_id(str(item.get("translation_unit_id", "")))
                or len(item.get("translation_unit_member_ids") or []) > 1
                or any(item.get(key) for key in ("formula_map", "protected_map", "translation_unit_formula_map",
                                                 "translation_unit_protected_map", "group_formula_map", "group_protected_map")))


# 整块只有一个编号或标签：1 / 1. / (7) / [12] / (5.6) / (3a) / (a) / (B) / (ii)。
# 没有可译内容，默认就原样保留、不发请求（原来只在 rust transport + page_local_v1 下生效，
# 默认配置下每个都单发一次约 1000 token 的请求）。裸的 1.2、12 mg、(S1) 之类不算。
_STANDALONE_LABEL_RE = re.compile(
    r"(?:[0-9]+\.?|\([0-9]+(?:\.[0-9]+)*[a-z]?\)|\[[0-9]+\]|\([A-Za-z]\)|\((?:i{1,3}|iv|vi{0,3}|ix|x)\))"
)


def is_standalone_number(item):
    if not is_isolated_single_unit(item):
        return False
    source = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or item.get("source_text") or "").strip()
    return _STANDALONE_LABEL_RE.fullmatch(source) is not None
