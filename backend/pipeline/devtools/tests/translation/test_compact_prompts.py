import json

import pytest

from retainpdf_pipeline.translate.llm.shared.prompt_building import (
    build_group_member_messages,
    build_messages,
    build_single_item_fallback_messages,
)
from retainpdf_pipeline.translate.prompt_loader import render_prompt


def item(**changes):
    return {"item_id": "p001-b001", "protected_source_text": "Energy $E=mc^2$ is conserved.",
            "math_mode": "direct_typst", "structure_role": "body", **changes}


@pytest.mark.parametrize("style", ["json", "tagged"])
def test_batch_math_guidance_does_not_override_output_protocol(style):
    messages = build_messages([item()], response_style=style)
    combined = "\n".join(m["content"] for m in messages)
    assert "不要输出占位符、结构化数据、标签" not in combined
    assert "不改变指定的输出协议" in combined
    if style == "tagged":
        assert "<<<ITEM" in combined
    else:
        assert "<<<ITEM" not in combined
        assert "JSON 协议" in messages[1]["content"]


def test_single_json_has_no_plain_text_instruction():
    messages = build_single_item_fallback_messages(item(), response_style="json")
    combined = "\n".join(m["content"] for m in messages)
    assert "不要输出编号、决策字段、结构化数据" not in combined
    assert "只返回译文本身，使用纯文本" not in combined
    assert "JSON 协议" in messages[1]["content"]


def test_group_preserves_member_contract_and_source():
    source = "Energy $E=mc^2$ is conserved."
    messages = build_group_member_messages(item(
        translation_unit_member_ids=["p001-b001"],
        translation_unit_members=[{"item_id": "p001-b001", "source_text": source}],
    ))
    assert '"member_translations"' in messages[0]["content"]
    assert "不要输出占位符、结构化数据、标签" not in messages[0]["content"]
    assert json.loads(messages[1]["content"])["group"]["members"][0]["source_text"] == source


@pytest.mark.parametrize("role,expected", [("body", ""), ("document_title", "标题规则"),
                                          ("reference_entry", "参考文献规则")])
@pytest.mark.parametrize("math_mode", ["direct_typst", "placeholder"])
def test_role_guidance_is_scoped(role, expected, math_mode):
    messages = build_single_item_fallback_messages(item(structure_role=role, math_mode=math_mode))
    assert "标题规则" not in messages[0]["content"]
    assert "参考文献规则" not in messages[0]["content"]
    if expected:
        assert expected in messages[1]["content"]
    else:
        assert "标题规则" not in messages[1]["content"]
        assert "参考文献规则" not in messages[1]["content"]


def test_compact_templates_keep_safety_rules_and_bounded_size():
    names = ["translation_system_plain_text.txt", "translation_output_plain_text.txt",
             "translation_task_plain_text.txt", "translation_direct_typst_guidance.txt"]
    fixed = "\n".join(render_prompt(n, target_language_name="简体中文") for n in names)
    assert len(fixed) < 1200  # Previous fixed templates: 1832 characters.
    assert "严禁从前后文借词补全" in fixed
    assert "占位符必须逐字保留且顺序不变" in fixed
    assert "最小修复" in fixed
    assert "不要补写缺失的正文内容" in fixed
    assert "正常词语（包括 and、or、the、vs）不按乱码处理" in fixed


def test_prompt_rebuild_does_not_change_source_or_context():
    original = item(continuation_prev_text="Before $x$.", continuation_next_text="After $y$.")
    saved = dict(original)
    messages = build_single_item_fallback_messages(original)
    assert original == saved
    assert original["protected_source_text"] in messages[1]["content"]
    assert "Before $x$." in messages[1]["content"]
    assert "After $y$." in messages[1]["content"]
