from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.llm.providers.deepseek import client as deepseek_client
from retainpdf_pipeline.translate.llm.providers.deepseek import translation_client
from retainpdf_pipeline.translate.core.context import build_item_context
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import group_member_json_user_prompt


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


def test_translate_continuation_group_members_repairs_loose_json_response() -> None:
    item = {
        "item_id": "__cg__:cg-010-001",
        "translation_unit_id": "__cg__:cg-010-001",
        "translation_unit_member_ids": ["p010-b001", "p010-b002"],
        "protected_source_text": "This sentence starts and continues.",
        "translation_unit_protected_source_text": "This sentence starts and continues.",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }

    def _fake_request(_messages, **_kwargs):
        return """
        {
          translated_text: "这句话开始并继续。",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "这句话开始"},
            {"item_id": "p010-b002", "translated_text": "并继续。"},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "这句话开始并继续。"
    assert payload["member_translations"][1]["translated_text"] == "并继续。"


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
    assert "不要返回结构化数据、代码块、标签、编号、决策字段或解释说明" in system_prompt
    assert "原文已有的受保护占位符仍须原样保留" in system_prompt
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


def test_group_member_json_user_prompt_includes_member_ids_and_schema() -> None:
    item_context = build_item_context(
        {
            "item_id": "__cg__:cg-010-001",
            "translation_unit_member_ids": ["p010-b001", "p010-b002"],
            "translation_unit_members": [
                {"item_id": "p010-b001", "protected_source_text": "This sentence starts"},
                {"item_id": "p010-b002", "protected_source_text": "and continues."},
            ],
            "continuation_group": "cg-010-001",
            "translation_unit_protected_source_text": "This sentence starts and continues.",
            "protected_source_text": "This sentence starts and continues.",
            "translation_context_after": "Do not include this context in output.",
            "metadata": {"structure_role": "body"},
        }
    )

    payload = json.loads(group_member_json_user_prompt(item_context))

    assert payload["group"]["item_id"] == "__cg__:cg-010-001"
    assert payload["group"]["member_ids"] == ["p010-b001", "p010-b002"]
    assert payload["group"]["members"] == [
        {"item_id": "p010-b001", "source_text": "This sentence starts"},
        {"item_id": "p010-b002", "source_text": "and continues."},
    ]
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
    assert "translated_text" not in payload["output_schema"]
    assert "combined_source_text" not in payload["group"]
    assert "Do not include this context" in payload["context_after"]


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
    assert "等字面量不得改写" in combined_prompt


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
    assert "使用单个反斜杠" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # 间距、紧贴、双反斜杠等机械格式规则由 normalize_direct_typst_translation
    # 在翻译时统一规整,不再占用提示词。
    assert "空格隔开" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode 上标字符" in system_prompt
    assert "$^{117}$" in system_prompt
    assert "$^{26-28}$" in system_prompt
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
    assert "使用单个反斜杠" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # 间距、紧贴、双反斜杠等机械格式规则由 normalize_direct_typst_translation
    # 在翻译时统一规整,不再占用提示词。
    assert "空格隔开" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode 上标字符" in system_prompt
    assert "$^{117}$" in system_prompt
    assert "$^{26-28}$" in system_prompt
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


def test_body_direct_typst_prompt_does_not_preserve_ocr_visual_lines() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p005-b025",
            "source_text": "For large $ CN_{A}^{\\prime} $ values, this d-level is lowered.",
            "protected_source_text": "For large $ CN_{A}^{\\prime} $ values, this d-level is lowered.",
            "source_line_texts": [
                "For large $ CN_{A}^{\\prime}",
                "$ values, this d-level is lowered.",
            ],
            "text_flow": "preserve_lines",
            "math_mode": "direct_typst",
            "semantic_role": "body",
            "structure_role": "body",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )

    assert "结构提示：当前原文是多行结构块" not in messages[1]["content"]
    assert "For large $ CN_{A}^{\\prime} $ values, this d-level is lowered." in messages[1]["content"]
    assert "For large $ CN_{A}^{\\prime}\n$ values" not in messages[1]["content"]


def test_toc_prompt_asks_model_to_translate_each_list_line() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p008-b001",
            "source_text": "FIGURE 11.7 Long figure title 370\nTABLE 8.4 Long table title 279",
            "protected_source_text": "FIGURE 11.7 Long figure title 370\nTABLE 8.4 Long table title 279",
            "source_line_texts": [
                "FIGURE 11.7 Long figure title 370",
                "TABLE 8.4 Long table title 279",
            ],
            "text_flow": "preserve_lines",
            "math_mode": "direct_typst",
            "semantic_role": "table_of_contents",
            "structure_role": "table_of_contents",
            "metadata": {"structure_role": "table_of_contents"},
        },
        mode="sci",
        response_style="plain_text",
    )

    prompt = messages[1]["content"]

    assert "目录/图表清单" in prompt
    assert "每个原文行输出一个译文行" in prompt
    assert "翻译行首标签和标题" in prompt
    assert "保留行尾页码" in prompt


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


def test_parse_translation_payload_accepts_well_formed_tagged_blocks() -> None:
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n<<<END>>>\n"
        "<<<ITEM item_id=b decision=keep_origin>>>\n\n<<<END>>>\n"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "译文A"
    assert result["b"]["decision"] == "keep_origin"


def test_parse_translation_payload_recovers_item_with_damaged_trailing_end_tag() -> None:
    # 真实事故形态(job ffc511 batch 2/8):模型在输出末尾把 <<<END>>>
    # 打成 <<<END>>,少一个 >。内容完好,不允许丢条目。
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n<<<END>>>\n"
        "<<<ITEM item_id=b>>>\n译文B,包含公式 $x^2$。\n<<<END>>"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "译文A"
    assert result["b"]["translated_text"] == "译文B,包含公式 $x^2$。"


def test_parse_translation_payload_treats_next_open_tag_as_implicit_close() -> None:
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n"
        "<<<ITEM item_id=b>>>\n译文B\n<<<END>>>"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "译文A"
    assert result["b"]["translated_text"] == "译文B"


def test_parse_translation_payload_does_not_cut_literal_end_text_mid_content() -> None:
    content = "<<<ITEM item_id=a>>>\n段落提到 END 这个词以及 <标记> 符号。\n<<<END>>>"
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "段落提到 END 这个词以及 <标记> 符号。"


def test_direct_typst_single_prompt_warns_model_about_unbalanced_source_dollars() -> None:
    # 源文本 $ 为奇数(OCR 丢了配对的 $)时,用户消息里要先提示模型按
    # 语义修复,而不是直接交给模型产出必然不平衡的译文。
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p009-b008",
            "protected_source_text": r"5a. $ ^{1}\text{H} $ NMR (CDCl $ _3 $, 400 MHz): $ \delta = 144.35, 143.01.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "数学定界符 `$` 数量为奇数" in messages[1]["content"]


def test_direct_typst_single_prompt_has_no_delimiter_warning_for_balanced_source() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": r"The energy is $E = mc^2$ at rest.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "数学定界符" not in messages[1]["content"]


def test_direct_typst_single_prompt_lists_mitex_rewrites_found_in_source() -> None:
    # 数据驱动提示:源公式匹配到数据库条目时,把需要的替换写进提示词,
    # 由模型在语义层完成替换——复杂公式里正则改写不可靠。
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": r"The operator $-i\hbar \partial/\partial q$ acts on $|\varPhi_0\rangle$.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    user_prompt = messages[1]["content"]
    assert "渲染器不支持" in user_prompt
    assert r"`\hbar` 改用 `ℏ`" in user_prompt
    assert r"`\varPhi` 改用 `\Phi`" in user_prompt
    assert r"`\rangle` 改用 `⟩`" in user_prompt
    # 数据库里有但本段没出现的命令,不应进提示词
    assert r"\mathscr" not in user_prompt


def test_direct_typst_single_prompt_has_no_rewrite_hint_for_clean_source() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b002",
            "protected_source_text": r"The energy $E = mc^2$ stays constant.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "渲染器不支持" not in messages[1]["content"]


def _cg_item(**overrides):
    item = {
        "item_id": "__cg__:cg-010-001",
        "translation_unit_id": "__cg__:cg-010-001",
        "translation_unit_member_ids": ["p010-b001", "p010-b002"],
        "protected_source_text": "The energy $E = mc^2$ starts and continues here.",
        "translation_unit_protected_source_text": "The energy $E = mc^2$ starts and continues here.",
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
    }
    item.update(overrides)
    return item


def test_group_members_retries_when_member_ids_are_missing() -> None:
    # 此前缺 member id 会静默退化成几何切分;现在先重试一次,第二次
    # 返回完整就采用结构化切分。
    responses = iter([
        json.dumps({
            "translated_text": "能量 $E = mc^2$ 开始并在此继续。",
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": "能量 $E = mc^2$ 开始"},
            ],
        }, ensure_ascii=False),
        json.dumps({
            "translated_text": "能量 $E = mc^2$ 开始并在此继续。",
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": "能量 $E = mc^2$ 开始"},
                {"item_id": "p010-b002", "translated_text": "并在此继续。"},
            ],
        }, ensure_ascii=False),
    ])
    calls = {"n": 0}

    def _fake_request(_messages, **_kwargs):
        calls["n"] += 1
        return next(responses)

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(_cg_item())

    assert calls["n"] == 2
    members = result["__cg__:cg-010-001"]["member_translations"]
    assert [m["item_id"] for m in members] == ["p010-b001", "p010-b002"]


def test_group_members_drops_repeated_aggregate_member_splits() -> None:
    aggregate = "考虑到这些困难，第一部分在前页；而第二部分在下一页。"
    repeated = json.dumps(
        {
            "translated_text": aggregate,
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": aggregate},
                {"item_id": "p010-b002", "translated_text": aggregate},
            ],
        },
        ensure_ascii=False,
    )

    with mock.patch.object(translation_client, "request_chat_content", return_value=repeated):
        result = translation_client.translate_continuation_group_members(_cg_item(math_mode="placeholder"))

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == aggregate
    assert payload["member_translations"] == []


def test_group_members_drops_splits_when_member_math_stays_unbalanced() -> None:
    # 公式跨 member 断开:整体 $ 奇偶数正确,但逐 member 都是坏的。
    # 重试后仍坏则丢弃 member 切分(显式走几何兜底),整体译文保留。
    bad = json.dumps({
        "translated_text": "能量 $E = mc^2$ 开始并在此继续。",
        "member_translations": [
            {"item_id": "p010-b001", "translated_text": "能量 $E = mc^2 开始"},
            {"item_id": "p010-b002", "translated_text": "$ 并在此继续。"},
        ],
    }, ensure_ascii=False)

    with mock.patch.object(translation_client, "request_chat_content", return_value=bad):
        result = translation_client.translate_continuation_group_members(_cg_item())

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "能量 $E = mc^2$ 开始并在此继续。"
    assert payload["member_translations"] == []


def test_group_members_salvages_aggregate_text_from_broken_json() -> None:
    # LaTeX 反斜杠转义损坏导致 JSON 无法解析:两轮解析都失败后,
    # 抢救 translated_text 字符串,不再整段丢弃。
    broken = (
        '{"translated_text": "能量守恒在此继续。",\n'
        '"member_translations": [{"item_id": "p010-b001", "translated_text": "能量 $\\alpha 守恒"'
    )

    with mock.patch.object(translation_client, "request_chat_content", return_value=broken):
        result = translation_client.translate_continuation_group_members(_cg_item())

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "能量守恒在此继续。"
    assert payload["member_translations"] == []


def test_context_bleed_downgraded_to_warning_for_continuation_items() -> None:
    from retainpdf_pipeline.translate.llm.validation.quality import review_translation_item

    # 连续段片段按设计无终止标点,后文公式泄漏由 apply 层机械修剪,
    # 不应触发昂贵的错误级重试。
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "the reaction rate depends on",
        "continuation_group": "cg-001",
        "translation_context_after": "the constant $k = A e^{-E_a/RT}$ as shown",
        "math_mode": "direct_typst",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }
    report = review_translation_item(item, {"decision": "translate", "translated_text": "反应速率取决于常数 $k = A e^{-E_a/RT}$"})
    bleed = [i for i in report.issues if i.kind == "context_bleed"]
    assert bleed and bleed[0].severity == "warning"

    standalone = dict(item)
    standalone.pop("continuation_group")
    report2 = review_translation_item(standalone, {"decision": "translate", "translated_text": "反应速率取决于常数 $k = A e^{-E_a/RT}$"})
    bleed2 = [i for i in report2.issues if i.kind == "context_bleed"]
    assert bleed2 and bleed2[0].severity == "error"


def test_direct_typst_single_prompt_moves_scoped_terms_into_user_message() -> None:
    # 词表按条目匹配后逐条不同,放 system 会打掉前缀缓存;
    # 匹配到的术语经 item 注入 user 消息。
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": "The SCF procedure converges quickly.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "_scoped_terms_guidance": "SCF => 自洽场",
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "SCF => 自洽场" not in messages[0]["content"]
    assert "术语要求：" in messages[1]["content"]
    assert "SCF => 自洽场" in messages[1]["content"]
