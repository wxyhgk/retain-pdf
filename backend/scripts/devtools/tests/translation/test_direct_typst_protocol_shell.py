import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.placeholder_guard import TranslationProtocolError
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import MathDelimiterError
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.shared.control_context import build_translation_control_context
from services.translation.llm.shared.orchestration.direct_typst import translate_direct_typst_plain_text_with_retries
from services.translation.llm.shared.orchestration.direct_typst_salvage import extract_direct_typst_protocol_text


def _body_item() -> dict:
    source = (
        "Example 4.2 Example Q-CHEM input for a single point energy calculation on water. "
        "Note that the declaration of the single point rem variable is redundant."
    )
    return {
        "item_id": "p014-b004",
        "page_idx": 13,
        "block_type": "text",
        "block_kind": "text",
        "semantic_role": "body",
        "structure_role": "body",
        "normalized_sub_type": "body",
        "translation_unit_protected_source_text": source,
        "protected_source_text": source,
    }


def test_extract_direct_typst_protocol_text_handles_fenced_json_translation_key() -> None:
    raw = '```json\n{"translation": "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"}\n```'

    assert extract_direct_typst_protocol_text(raw, item_id="p014-b004") == "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"


def test_extract_direct_typst_protocol_text_handles_item_id_mapping() -> None:
    raw = '{"p014-b004": "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"}'

    assert extract_direct_typst_protocol_text(raw, item_id="p014-b004") == "示例 4.2：水分子单点能计算的 Q-CHEM 输入。"


def test_repeated_direct_typst_protocol_shell_degrades_to_keep_origin() -> None:
    item = _body_item()

    def fail_with_protocol_shell(*args, **kwargs):
        raise TranslationProtocolError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text='{"translated_text": {"text": "bad shell"}}',
        )

    result = translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="unit",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        translator=None,
        translate_plain_fn=fail_with_protocol_shell,
        translate_unstructured_fn=fail_with_protocol_shell,
    )

    payload = result[item["item_id"]]
    diagnostics = payload["translation_diagnostics"]
    assert payload["decision"] == "keep_origin"
    assert payload["final_status"] == "kept_origin"
    assert diagnostics["degradation_reason"] == "protocol_shell_repeated"
    assert diagnostics["error_trace"] == [{"type": "validation", "code": "PROTOCOL_SHELL"}]


def test_direct_typst_math_delimiter_failure_uses_llm_repair_before_retry() -> None:
    item = _body_item()
    item["math_mode"] = "direct_typst"
    broken = "请在 $ m' 数学片段附近保持语法。"

    def fail_with_math_delimiter(*args, **kwargs):
        raise MathDelimiterError(
            item["item_id"],
            source_text=item["translation_unit_protected_source_text"],
            translated_text=broken,
        )

    def repair_math_delimiters(item, **kwargs):
        return {
            item["item_id"]: {
                "decision": "translate",
                "translated_text": "请在 $ m' $ 数学片段附近保持语法。",
                "final_status": "translated",
                "translation_diagnostics": {
                    "route_path": ["block_level", "direct_typst", "typst_repair"],
                    "degradation_reason": "typst_math_repaired",
                },
            }
        }

    result = translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        request_label="unit",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        translator=None,
        translate_plain_fn=fail_with_math_delimiter,
        translate_unstructured_fn=fail_with_math_delimiter,
        repair_math_delimiters_fn=repair_math_delimiters,
    )

    payload = result[item["item_id"]]
    assert payload["decision"] == "translate"
    assert "$ m' $" in payload["translated_text"]
    assert payload["translation_diagnostics"]["degradation_reason"] == "typst_math_repaired"


def test_direct_typst_no_longer_auto_escapes_manual_style_bare_dollar_variables() -> None:
    item = _body_item()
    item["math_mode"] = "direct_typst"
    translated = "要启用该计算，请在 $rem 部分设置 INCDFT = 2，并使用 $active_orbitals 输入段。"

    result = canonicalize_batch_result([item], {item["item_id"]: result_entry("translate", translated)})

    validate_batch_result([item], result)
    assert result[item["item_id"]]["translated_text"] == translated
