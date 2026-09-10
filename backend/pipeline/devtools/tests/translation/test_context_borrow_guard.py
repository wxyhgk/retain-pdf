"""借词幻觉回归:半句 + 图注上下文不得编出上下文独有实词.

真实案例(Nickel 论文 job):p023-b006 源文半句 "there have been no examples of"
配图注上下文,模型译文编出原文没有的 "Scheme 18 所示类型",违反"当前块优先"
原则.本文件锁定三件事:
1. prompt 模板与组装后的 prompt 含"半句照翻、严禁借词"硬指令;
2. 结果校验对上下文独有实词(Scheme 编号/上下文专有名词)给出 warning 级
   context_borrow,标记复修而不丢弃;
3. 正常续接(译文不含上下文独有词)不受误伤.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import (
    HALF_SENTENCE_NO_BORROW_GUARD,
    group_member_json_user_prompt,
)
from retainpdf_pipeline.translate.core.context import build_item_context
from retainpdf_pipeline.translate.llm.validation.quality import review_translation_item


HALF_SENTENCE_SOURCE = "there have been no examples of"
CAPTION_CONTEXT = "Scheme 18 shows the reaction types of nickel catalysis discussed above"
BORROWED_TRANSLATION = "目前尚无Scheme 18所示类型的反应实例。"


def _nickel_item(**overrides) -> dict:
    item = {
        "item_id": "p023-b006",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": HALF_SENTENCE_SOURCE,
        "continuation_next_text": CAPTION_CONTEXT,
    }
    item.update(overrides)
    return item


def test_prompt_templates_forbid_borrowing_for_half_sentence() -> None:
    for name in (
        "translation_task.txt",
        "translation_system.txt",
        "translation_system_plain_text.txt",
    ):
        assert HALF_SENTENCE_NO_BORROW_GUARD in load_prompt(name), name

    # The compact user task relies on the system guard instead of duplicating it.
    from retainpdf_pipeline.translate.llm.shared.prompt_building import build_single_item_fallback_messages

    for math_mode in ("placeholder", "direct_typst"):
        for style in ("plain_text", "json"):
            messages = build_single_item_fallback_messages(
                _nickel_item(math_mode=math_mode), response_style=style,
            )
            assert HALF_SENTENCE_NO_BORROW_GUARD in messages[0]["content"]


def test_plain_text_prompt_adds_no_borrow_guard_for_half_sentence() -> None:
    from retainpdf_pipeline.translate.llm.providers.deepseek import client as deepseek_client

    messages = deepseek_client.build_single_item_fallback_messages(
        _nickel_item(),
        mode="sci",
        response_style="plain_text",
    )
    user_prompt = messages[1]["content"]
    assert "当前原文是不完整片段；译文必须保持同等不完整，不要用后文上下文补全。" in user_prompt
    assert HALF_SENTENCE_NO_BORROW_GUARD in user_prompt
    assert "后文上下文（仅供理解，禁止翻译进输出）" in user_prompt


def test_group_member_prompt_forbids_borrowing_for_incomplete_fragment() -> None:
    item_context = build_item_context(
        {
            "item_id": "__cg__:cg-023-001",
            "translation_unit_member_ids": ["p023-b006", "p023-b007"],
            "translation_unit_members": [
                {"item_id": "p023-b006", "protected_source_text": HALF_SENTENCE_SOURCE},
                {"item_id": "p023-b007", "protected_source_text": "for this transformation."},
            ],
            "continuation_group": "cg-023-001",
            "translation_unit_protected_source_text": f"{HALF_SENTENCE_SOURCE} for this transformation.",
            "protected_source_text": f"{HALF_SENTENCE_SOURCE} for this transformation.",
            "translation_context_after": CAPTION_CONTEXT,
            "metadata": {"structure_role": "body"},
        }
    )
    payload = json.loads(group_member_json_user_prompt(item_context))
    assert "never borrow words from neighboring context" in payload["task"]
    assert "equally incomplete" in payload["task"]


def test_quality_flags_scheme_number_borrowed_from_caption() -> None:
    report = review_translation_item(
        _nickel_item(),
        {"decision": "translate", "translated_text": BORROWED_TRANSLATION},
    )
    borrow = [issue for issue in report.issues if issue.kind == "context_borrow"]
    assert borrow, [issue.as_dict() for issue in report.issues]
    assert borrow[0].severity == "warning"
    assert borrow[0].retryable is True
    assert any("18" in term for term in (borrow[0].details or {}).get("borrowed_terms", []))
    # 轻检查只标记复修,不丢弃:整体不判 error.
    assert not report.has_errors


def test_quality_flags_proper_noun_borrowed_from_context() -> None:
    item = _nickel_item(
        continuation_next_text="The BuchwaldHartwig coupling proceeds in high yield",
    )
    report = review_translation_item(
        item,
        {"decision": "translate", "translated_text": "目前尚无实例，BuchwaldHartwig偶联收率很高。"},
    )
    kinds = {issue.kind for issue in report.issues}
    assert "context_borrow" in kinds


def test_quality_allows_normal_continuation_without_borrowing() -> None:
    item = {
        "item_id": "p023-b007",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": "The reaction was carried out at room temperature.",
        "continuation_next_text": CAPTION_CONTEXT,
    }
    report = review_translation_item(
        item,
        {"decision": "translate", "translated_text": "反应在室温下进行。"},
    )
    assert "context_borrow" not in {issue.kind for issue in report.issues}


def test_quality_allows_label_present_in_source() -> None:
    item = {
        "item_id": "p023-b008",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": "As shown in Scheme 18, the yield is high.",
        "continuation_next_text": CAPTION_CONTEXT,
    }
    report = review_translation_item(
        item,
        {"decision": "translate", "translated_text": "如Scheme 18所示，收率很高。"},
    )
    assert "context_borrow" not in {issue.kind for issue in report.issues}


def test_quality_exempts_glossary_terms() -> None:
    from retainpdf_pipeline.translate.core.terms import GlossaryEntry

    item = {
        "item_id": "p023-b009",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "translation_unit_protected_source_text": "The cycle converges quickly.",
        "continuation_next_text": "Hartree-Fock orbitals converge slowly in this basis",
    }
    report = review_translation_item(
        item,
        {"decision": "translate", "translated_text": "该Hartree-Fock循环收敛很快。"},
        glossary_entries=[
            GlossaryEntry(source="Hartree-Fock", target="Hartree-Fock", level="preserve"),
        ],
    )
    assert "context_borrow" not in {issue.kind for issue in report.issues}
