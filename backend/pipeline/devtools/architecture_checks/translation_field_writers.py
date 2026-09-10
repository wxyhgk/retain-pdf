from __future__ import annotations

import ast
from pathlib import Path

from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import rel
from devtools.architecture_checks.common import scan_py_files
from devtools.architecture_checks.translation_rules import TRANSLATION_ROOT


# payload 状态字段的唯一 writer 门禁。
#
# 背景:12 步翻译流水线共享同一批可变 payload item dict,历史上任何阶段都能
# 直接写状态字段,导致覆盖类 bug(如编排阶段覆盖 policy 写的 skip_reason)。
# 本检查冻结每个字段的现有 writer 文件集合:新代码不得在集合之外写这些 key,
# 想写就调用 owner 模块的 helper,或先在这里为收敛后的新 owner 更新规则。
#
# 标注约定:
# - owner        字段语义上的收口模块,长期保留
# - frozen-debt  当前现实存在、目标是逐步移除的写入点(收敛 PR 完成后从这里删除)
PAYLOAD_FIELD_WRITER_ALLOWLIST: dict[str, frozenset[str]] = {
    # ---- policy 决策字段:owner = core/payload/parts/policy_state.py ----
    "should_translate": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/policy_state.py",  # owner
            "retainpdf_pipeline/translate/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    "skip_reason": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/policy_state.py",  # owner
            "retainpdf_pipeline/translate/core/payload/parts/common.py",  # frozen-debt: seed 补缺(只补不覆盖)
        }
    ),
    "classification_label": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/policy_state.py",  # owner
            "retainpdf_pipeline/translate/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    # ---- 最终状态:payload item 上唯一赋值点 = final_status.py::set_final_status ----
    # 其余条目是 result metadata dict / diagnostics dict 的同名 key 写入(非 payload item),
    # 属结果链路;一并冻结,防止新文件再引入同名写入。
    "final_status": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/final_status.py",  # owner: set_final_status 漏斗
            "retainpdf_pipeline/translate/core/payload/parts/result_status.py",  # diagnostics dict
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # result metadata(邻段泄漏降级)
            "retainpdf_pipeline/translate/core/payload/parts/result_entries.py",  # result metadata
            "retainpdf_pipeline/translate/core/payload/template_contract.py",  # frozen-debt
            "retainpdf_pipeline/translate/artifacts/io.py",  # frozen-debt: 诊断产物
            "retainpdf_pipeline/translate/artifacts/status.py",  # frozen-debt: 诊断产物
            "retainpdf_pipeline/translate/llm/placeholder_transform.py",  # result metadata
            "retainpdf_pipeline/translate/llm/result_canonicalizer.py",  # result metadata
            "retainpdf_pipeline/translate/llm/result_payload.py",  # result metadata
            "retainpdf_pipeline/translate/llm/shared/orchestration/metadata.py",  # result metadata
            "retainpdf_pipeline/translate/llm/shared/orchestration/sentence_level.py",  # result metadata
            "retainpdf_pipeline/translate/llm/shared/orchestration/terminal_payloads.py",  # result metadata
            "retainpdf_pipeline/translate/services/postprocess/garbled_reconstruction.py",  # diagnostics dict
        }
    ),
    # ---- 诊断:owner = core/payload/parts/diagnostics.py(顶层 merge + history 追加) ----
    # 修复链(乱码重建/agent repair/最终收口)已迁移;其余为 result metadata /
    # 初次产生诊断的路径,冻结待后续按 stage 身份逐步迁移。
    "translation_diagnostics": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/diagnostics.py",  # owner: record_translation_diagnostics
            "retainpdf_pipeline/translate/core/payload/parts/final_status.py",  # owner: 违规面包屑
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # frozen-debt: 回填初次写入
            "retainpdf_pipeline/translate/core/payload/parts/result_entries.py",  # result metadata
            "retainpdf_pipeline/translate/core/payload/parts/result_status.py",  # frozen-debt
            "retainpdf_pipeline/translate/llm/shared/orchestration/direct_typst_long_text.py",  # result metadata
            "retainpdf_pipeline/translate/llm/shared/orchestration/heavy_formula.py",  # result metadata
            "retainpdf_pipeline/translate/llm/shared/orchestration/metadata.py",  # result metadata
            "retainpdf_pipeline/translate/llm/shared/orchestration/sentence_level.py",  # result metadata
            "retainpdf_pipeline/translate/llm/shared/orchestration/terminal_payloads.py",  # result metadata
            "retainpdf_pipeline/translate/services/fast_path/keep_origin.py",  # frozen-debt
            "retainpdf_pipeline/translate/services/finalization/untranslated.py",  # result payload(经 apply 回填)
            "retainpdf_pipeline/translate/services/results/applier.py",  # frozen-debt
        }
    ),
    # ---- 译文字段:owner = core/payload/parts/apply.py ----
    "translated_text": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # owner
            "retainpdf_pipeline/translate/core/payload/parts/policy_state.py",  # owner: clear/preserve
            "retainpdf_pipeline/translate/llm/shared/orchestration/metadata.py",  # result metadata
        }
    ),
    "protected_translated_text": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # owner
            "retainpdf_pipeline/translate/core/payload/parts/policy_state.py",  # owner: clear/preserve
            "retainpdf_pipeline/translate/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    "translation_unit_translated_text": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # owner
            "retainpdf_pipeline/translate/core/payload/parts/policy_state.py",  # owner: clear/preserve
        }
    ),
    "translation_unit_protected_translated_text": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # owner
            "retainpdf_pipeline/translate/core/payload/parts/policy_state.py",  # owner: clear/preserve
        }
    ),
    "group_translated_text": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # owner
            "retainpdf_pipeline/translate/core/payload/parts/translation_units.py",  # owner: 分组 reset
            "retainpdf_pipeline/translate/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    "group_protected_translated_text": frozenset(
        {
            "retainpdf_pipeline/translate/core/payload/parts/apply.py",  # owner
            "retainpdf_pipeline/translate/core/payload/parts/translation_units.py",  # owner: 分组 reset
            "retainpdf_pipeline/translate/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
}

_FIELD_OWNER_HINT = {
    "should_translate": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "skip_reason": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "classification_label": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "final_status": "core/payload/parts/final_status.py (set_final_status),或更高层的 result_status.py mark_* helper",
    "translation_diagnostics": "core/payload/parts/diagnostics.py (record_translation_diagnostics)",
    "translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "protected_translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "translation_unit_translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "translation_unit_protected_translated_text": "core/payload/parts/apply.py (apply_single/group_translated_entry)",
    "group_translated_text": "core/payload/parts/apply.py (apply_group_translated_entry)",
    "group_protected_translated_text": "core/payload/parts/apply.py (apply_group_translated_entry)",
}


def _subscript_write_keys(node: ast.AST) -> list[str]:
    keys: list[str] = []
    targets: list[ast.expr] = []
    if isinstance(node, ast.Assign):
        targets = list(node.targets)
    elif isinstance(node, (ast.AugAssign, ast.AnnAssign)):
        targets = [node.target]
    elif isinstance(node, ast.Delete):
        targets = list(node.targets)
    for target in targets:
        elements = target.elts if isinstance(target, (ast.Tuple, ast.List)) else [target]
        for element in elements:
            if (
                isinstance(element, ast.Subscript)
                and isinstance(element.slice, ast.Constant)
                and isinstance(element.slice.value, str)
            ):
                keys.append(element.slice.value)
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in {"setdefault", "pop"}
        and node.args
        and isinstance(node.args[0], ast.Constant)
        and isinstance(node.args[0].value, str)
    ):
        keys.append(node.args[0].value)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "update":
        keys.extend(keyword.arg for keyword in node.keywords if keyword.arg is not None)
        for argument in (*node.args, *(keyword.value for keyword in node.keywords if keyword.arg is None)):
            keys.extend(_literal_mapping_keys(argument))
    if isinstance(node, ast.AugAssign) and isinstance(node.op, ast.BitOr):
        keys.extend(_literal_mapping_keys(node.value))
    return keys


def _literal_mapping_keys(node: ast.AST) -> list[str]:
    # Recognize only explicit mapping mutations, not arbitrary dictionary
    # construction/reads or unknown runtime keys. This is not alias analysis.
    if not isinstance(node, ast.Dict):
        return []
    keys = []
    for key, value in zip(node.keys, node.values):
        if isinstance(key, ast.Constant) and isinstance(key.value, str):
            keys.append(key.value)
        elif key is None:
            keys.extend(_literal_mapping_keys(value))
    return keys


def gated_field_writes(tree: ast.AST) -> dict[str, list[int]]:
    """返回 AST 中对受门禁字段的写入:field -> 行号列表。"""
    writes: dict[str, list[int]] = {}
    for node in ast.walk(tree):
        for key in _subscript_write_keys(node):
            if key in PAYLOAD_FIELD_WRITER_ALLOWLIST:
                writes.setdefault(key, []).append(getattr(node, "lineno", 0))
    return writes


def check_translation_payload_field_writers(errors: list[str]) -> None:
    for path in scan_py_files(TRANSLATION_ROOT):
        rel_path = Path(rel(path)).as_posix()
        tree = parse_python_file(path)
        for field, lines in sorted(gated_field_writes(tree).items()):
            if rel_path in PAYLOAD_FIELD_WRITER_ALLOWLIST[field]:
                continue
            owner_hint = _FIELD_OWNER_HINT.get(field, "该字段的 owner 模块")
            for line in lines:
                errors.append(
                    f"{rel_path}:{line}: 禁止直接写入 payload 字段 \"{field}\"; "
                    f"请改用 {owner_hint}, 或在 translation_field_writers.py 中为收敛后的 owner 更新规则"
                )
