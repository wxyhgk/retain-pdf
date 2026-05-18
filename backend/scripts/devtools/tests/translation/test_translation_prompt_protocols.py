from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client


def test_translate_single_item_plain_text_uses_plain_text_protocol() -> None:
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "The advancement of complex computer programs.",
        "translation_unit_protected_source_text": "The advancement of complex computer programs.",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }
    captured: dict[str, object] = {}

    def _fake_messages(*args, **kwargs):
        captured["response_style"] = kwargs.get("response_style")
        return [{"role": "system", "content": "stub"}]

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        captured["response_format"] = kwargs.get("response_format")
        return "复杂计算机程序的发展。"

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "复杂计算机程序的发展。"


def test_translate_batch_once_uses_tagged_protocol_without_schema() -> None:
    batch = [
        {
            "item_id": "p001-b001",
            "protected_source_text": "The advancement of complex computer programs.",
            "translation_unit_protected_source_text": "The advancement of complex computer programs.",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        },
        {
            "item_id": "p001-b002",
            "protected_source_text": "Faster computing power improves simulation.",
            "translation_unit_protected_source_text": "Faster computing power improves simulation.",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        },
    ]
    captured: dict[str, object] = {}

    def _fake_messages(*args, **kwargs):
        captured["response_style"] = kwargs.get("response_style")
        return [{"role": "system", "content": "stub"}]

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        captured["response_format"] = kwargs.get("response_format")
        return (
            "<<<ITEM item_id=p001-b001>>>\n复杂计算机程序的发展。\n<<<END>>>\n"
            "<<<ITEM item_id=p001-b002>>>\n更快的算力提升了模拟能力。\n<<<END>>>"
        )

    with mock.patch.object(translation_client, "build_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_batch_once(batch, mode="fast")

    assert captured["response_style"] == "tagged"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "复杂计算机程序的发展。"
    assert result["p001-b002"]["translated_text"] == "更快的算力提升了模拟能力。"


def test_build_messages_sci_tagged_uses_translation_only_protocol() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p001-b001",
                "protected_source_text": "Experimentally test the mechanism.",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    assert "<<<ITEM item_id=ITEM_ID>>>" in messages[0]["content"]
    assert "decision=translate" not in messages[0]["content"]


def test_build_messages_sanitizes_continuation_context_placeholders() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p006-b056",
                "protected_source_text": "The combination of these results",
                "continuation_group": "cg-001",
                "continuation_next_text": "evidence against a <f1-2e5/> catalytic cycle and <f2-9ad/> reaction pathway",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    payload = json.loads(messages[1]["content"])
    item_payload = payload["items"][0]
    assert (
        item_payload["context_after"]
        == "仅供理解，禁止翻译进输出：evidence against a catalytic cycle and reaction pathway"
    )
    assert "<f1-2e5/>" not in messages[1]["content"]
    assert "<f2-9ad/>" not in messages[1]["content"]


def test_build_single_item_fallback_messages_sanitizes_continuation_context_placeholders() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p006-b056",
            "protected_source_text": "The combination of these results",
            "continuation_next_text": "evidence against a <f1-2e5/> catalytic cycle and <f2-9ad/> reaction pathway",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "当前原文是不完整片段；译文必须保持同等不完整，不要用后文上下文补全。" in messages[1]["content"]
    assert "后文上下文（仅供理解，禁止翻译进输出）：evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
    assert "<f1-2e5/>" not in messages[1]["content"]
    assert "<f2-9ad/>" not in messages[1]["content"]


def test_build_single_item_fallback_messages_plain_text_has_no_json_contract_conflict() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p014-b004",
            "protected_source_text": "Example 4.2 Example Q-CHEM input for a single point energy calculation on water.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    system_prompt = messages[0]["content"]

    assert "只返回译文本身，使用纯文本。" in system_prompt
    assert "不要输出占位符、结构化数据、标签、代码块或解释" in system_prompt
    assert "返回结果时只输出符合以下结构的合法 JSON" not in system_prompt
    assert '{"translations":[{"item_id":"...","translated_text":"..."}]}' not in system_prompt
    assert "source_text" not in system_prompt
    assert "translated_text" not in system_prompt
    assert "item_id" not in system_prompt
    assert "decision" not in system_prompt
    assert "JSON" not in system_prompt


def test_build_single_item_fallback_messages_plain_text_user_prompt_is_not_json() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p026-b007",
            "protected_source_text": "As for any numerical optimization procedure, Q-CHEM features SCF algorithms.",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )

    assert "【当前原文开始】" in messages[1]["content"]
    assert "【当前原文结束】" in messages[1]["content"]
    assert "As for any numerical optimization procedure" in messages[1]["content"]
    assert "source_text" not in messages[1]["content"]
    assert "item_id" not in messages[1]["content"]
    assert "decision" not in messages[1]["content"]
    assert "JSON" not in messages[1]["content"]
    assert '"item_id"' not in messages[1]["content"]
    assert '"source_text"' not in messages[1]["content"]


def test_plain_text_prompt_keeps_literal_preservation_in_translation_scope() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p006-b012",
            "protected_source_text": "$ uv pip install ./deepx-1.0.6+light-py3-none-any.whl[gpu]",
            "block_type": "text",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    combined_prompt = "\n".join(message["content"] for message in messages)

    assert "不要只依赖 OCR" not in combined_prompt
    assert "独立代码、命令、配置、输入文件、目录树或文件清单" not in combined_prompt
    assert "请原样返回" not in combined_prompt
    assert "字面量部分逐字保留" in combined_prompt


def test_sci_tagged_prompt_does_not_make_translation_model_choose_keep_origin() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p006-b012",
                "protected_source_text": "$ uv pip install ./deepx-1.0.6+light-py3-none-any.whl[gpu]",
                "block_type": "text",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )

    assert "独立代码、命令、配置、输入文件、目录树或文件清单" not in messages[0]["content"]
    assert "keep_origin" not in messages[0]["content"]


def test_build_messages_direct_typst_includes_inline_math_and_local_ocr_repair_guidance() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p001-b001",
                "protected_source_text": r"^{a} reaction at {10\mu}mol scale",
                "math_mode": "direct_typst",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    system_prompt = messages[0]["content"]
    user_prompt = messages[1]["content"]
    assert "当前启用 direct_typst 公式直出模式" in system_prompt
    assert "请先理解整句语义" in system_prompt
    assert "请主动用 `$...$` 包裹" in system_prompt
    assert "只能使用单个反斜杠" in system_prompt
    assert r"\text{g}" in system_prompt
    assert r"\\text{g}" in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "上标引用" in system_prompt
    assert "最小修复" in system_prompt
    assert "不要补写缺失的正文内容" in system_prompt
    assert "<<<ITEM item_id=ITEM_ID>>>" in system_prompt
    assert "请为每段输出一个 tagged block" in user_prompt
    assert "不要回写编号、决策字段、结构化数据或标签" not in user_prompt
    assert r"\mu" in messages[1]["content"]
    assert r"\\mu" not in messages[1]["content"]


def test_build_single_item_fallback_messages_direct_typst_includes_inline_math_and_local_ocr_repair_guidance() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": r"^{a} reaction at {10\mu}mol scale",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    system_prompt = messages[0]["content"]
    assert "当前启用 direct_typst 公式直出模式" in system_prompt
    assert "请先理解整句语义" in system_prompt
    assert "请主动用 `$...$` 包裹" in system_prompt
    assert "只能使用单个反斜杠" in system_prompt
    assert r"\text{g}" in system_prompt
    assert r"\\text{g}" in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "上标引用" in system_prompt
    assert "最小修复" in system_prompt
    assert "不要补写缺失的正文内容" in system_prompt
    assert r"\mu" in messages[1]["content"]
    assert r"\\mu" not in messages[1]["content"]


def test_build_messages_direct_typst_keeps_single_backslash_source_text_in_user_prompt() -> None:
    messages = deepseek_client.build_messages(
        [
            {
                "item_id": "p010-b002",
                "protected_source_text": r"strengthens the argument that a \mathrm{Ni(I) / Ni(III)} cycle is operative.",
                "math_mode": "direct_typst",
                "metadata": {"structure_role": "body"},
            }
        ],
        mode="sci",
        response_style="tagged",
    )
    assert r"\mathrm{Ni(I) / Ni(III)}" in messages[1]["content"]
    assert r"\\mathrm{Ni(I) / Ni(III)}" not in messages[1]["content"]


def test_build_single_item_fallback_messages_direct_typst_keeps_single_backslash_source_text_in_user_prompt() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p010-b002",
            "protected_source_text": r"strengthens the argument that a \mathrm{Ni(I) / Ni(III)} cycle is operative.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert r"\mathrm{Ni(I) / Ni(III)}" in messages[1]["content"]
    assert r"\\mathrm{Ni(I) / Ni(III)}" not in messages[1]["content"]


def test_prompt_builder_can_render_non_default_target_language() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": "保持术语准确。",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
        target_language_name="英文",
    )
    combined_prompt = "\n".join(message["content"] for message in messages)

    assert "适合论文排版的英文" in combined_prompt
    assert "直接输出英文译文" in combined_prompt
    assert "最终英文译文正文" in combined_prompt
    assert "适合论文排版的简体中文" not in combined_prompt
