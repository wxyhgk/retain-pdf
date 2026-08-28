from __future__ import annotations

import ast
from pathlib import Path

from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import rel
from devtools.architecture_checks.common import scan_py_files
from devtools.architecture_checks.translation_rules import TRANSLATION_ROOT


# Kiểm soát writer duy nhất cho các trường trạng thái payload.
#
# Bối cảnh: 12 bước của quy trình dịch chia sẻ cùng một nhóm dict payload item có thể thay đổi, trong lịch sử bất kỳ giai đoạn nào cũng có thể
# trực tiếp ghi vào các trường trạng thái, dẫn đến các bug ghi đè (ví dụ: giai đoạn điều phối ghi đè skip_reason do policy ghi).
# Kiểm tra này đóng băng tập hợp các file writer hiện có cho mỗi trường: mã mới không được phép ghi các key này bên ngoài tập hợp,
# muốn ghi thì gọi helper của mô-đun owner, hoặc cập nhật quy tắc tại đây cho owner mới sau khi đã thu gọn.
#
# Quy ước đánh dấu:
# - owner        Mô-đun đảm nhận ngữ nghĩa của trường, được giữ lâu dài
# - frozen-debt  Các điểm ghi hiện tồn tại trong thực tế, mục tiêu là dần loại bỏ (xóa khỏi đây sau khi PR thu gọn hoàn thành)
PAYLOAD_FIELD_WRITER_ALLOWLIST: dict[str, frozenset[str]] = {
    # ---- Trường quyết định policy: owner = core/payload/parts/policy_state.py ----
    "should_translate": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    "skip_reason": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/parts/common.py",  # frozen-debt: Bổ sung seed (chỉ bổ sung không ghi đè)
        }
    ),
    "classification_label": frozenset(
        {
            "services/translation/core/payload/parts/policy_state.py",  # owner
            "services/translation/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    # ---- Trạng thái cuối: Điểm gán duy nhất trên payload item = final_status.py::set_final_status ----
    # Các mục còn lại là ghi key cùng tên vào result metadata dict / diagnostics dict (không phải payload item),
    # thuộc chuỗi kết quả; đóng băng cùng nhau để ngăn file mới lại thêm ghi trùng tên.
    "final_status": frozenset(
        {
            "services/translation/core/payload/parts/final_status.py",  # owner: set_final_status 漏斗
            "services/translation/core/payload/parts/result_status.py",  # diagnostics dict
            "services/translation/core/payload/parts/apply.py",  # result metadata(邻段泄漏降级)
            "services/translation/core/payload/parts/result_entries.py",  # result metadata
            "services/translation/core/payload/template_contract.py",  # frozen-debt
            "services/translation/artifacts/io.py",  # frozen-debt: Sản phẩm chẩn đoán
            "services/translation/artifacts/status.py",  # frozen-debt: 诊断产物
            "services/translation/llm/placeholder_transform.py",  # result metadata
            "services/translation/llm/result_canonicalizer.py",  # result metadata
            "services/translation/llm/result_payload.py",  # result metadata
            "services/translation/llm/shared/orchestration/metadata.py",  # result metadata
            "services/translation/llm/shared/orchestration/sentence_level.py",  # result metadata
            "services/translation/llm/shared/orchestration/terminal_payloads.py",  # result metadata
            "services/translation/services/postprocess/garbled_reconstruction.py",  # diagnostics dict
        }
    ),
    # ---- Chẩn đoán: owner = core/payload/parts/diagnostics.py (merge cấp cao + thêm lịch sử) ----
    # Chuỗi sửa chữa (tái tạo mã hỏng/agent repair/thu gọn cuối) đã được di chuyển;
    # các mục còn lại là đường dẫn tạo chẩn đoán lần đầu, đóng băng để dần di chuyển theo danh tính stage.
    "translation_diagnostics": frozenset(
        {
            "services/translation/core/payload/parts/diagnostics.py",  # owner: record_translation_diagnostics
            "services/translation/core/payload/parts/final_status.py",  # owner: Breadcrumb vi phạm
            "services/translation/core/payload/parts/apply.py",      # frozen-debt: Ghi điền lần đầu
            "services/translation/core/payload/parts/result_entries.py",  # result metadata
            "services/translation/core/payload/parts/result_status.py",  # frozen-debt
            "services/translation/llm/shared/orchestration/direct_typst_long_text.py",  # result metadata
            "services/translation/llm/shared/orchestration/heavy_formula.py",  # result metadata
            "services/translation/llm/shared/orchestration/metadata.py",  # result metadata
            "services/translation/llm/shared/orchestration/sentence_level.py",  # result metadata
            "services/translation/llm/shared/orchestration/terminal_payloads.py",  # result metadata
            "services/translation/services/fast_path/keep_origin.py",  # frozen-debt
            "services/translation/services/finalization/untranslated.py",  # result payload(经 apply 回填)
            "services/translation/services/results/applier.py",  # frozen-debt
        }
    ),
    # ---- Trường văn bản dịch: owner = core/payload/parts/apply.py ----
    "translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
            "services/translation/llm/shared/orchestration/metadata.py",  # result metadata
        }
    ),
    "protected_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
            "services/translation/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    "translation_unit_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
        }
    ),
    "translation_unit_protected_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/policy_state.py",  # owner: clear/preserve
        }
    ),
    "group_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/translation_units.py",  # owner: 分组 reset
            "services/translation/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
    "group_protected_translated_text": frozenset(
        {
            "services/translation/core/payload/parts/apply.py",  # owner
            "services/translation/core/payload/parts/translation_units.py",  # owner: 分组 reset
            "services/translation/core/payload/template_sync.py",  # frozen-debt: 模板同步回填
        }
    ),
}

_FIELD_OWNER_HINT = {
    "should_translate": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "skip_reason": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "classification_label": "core/payload/parts/policy_state.py (mark_policy_skip / mark_translation_required)",
    "final_status": "core/payload/parts/final_status.py (set_final_status), hoặc helper mark_* cấp cao hơn từ result_status.py",
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
        and node.func.attr == "setdefault"
        and node.args
        and isinstance(node.args[0], ast.Constant)
        and isinstance(node.args[0].value, str)
    ):
        keys.append(node.args[0].value)
    return keys


def gated_field_writes(tree: ast.AST) -> dict[str, list[int]]:
    """trở lại AST Ghi vào các trường được kiểm soát trong:field -> Danh sách số dòng。"""
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
                    f"{rel_path}:{line}: Cấm ghi trực tiếp vào trường payload \"{field}\"; "
                    f"hãy sử dụng {owner_hint}, hoặc cập nhật quy tắc cho owner sau khi thu gọn trong translation_field_writers.py"
                )
