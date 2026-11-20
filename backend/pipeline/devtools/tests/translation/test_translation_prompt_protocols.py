from __future__ import annotations

import json
from unittest import mock


from retainpdf_translation.llm.shared import prompt_building
from retainpdf_translation.llm.providers.deepseek import client as deepseek_client
from retainpdf_translation.llm.providers.deepseek import translation_client


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
    messages = prompt_building.build_messages(
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
    messages = prompt_building.build_messages(
        [
            {
                # 显式 placeholder:本用例测的是 <f1-2e5/> 这类保护 token 要从
                # continuation 上下文里清掉,而保护 token 只在 placeholder 模式产生。
                "math_mode": "placeholder",
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    assert "【后文开始（仅供理解，禁止翻译进输出）】\nevidence against a catalytic cycle and reaction pathway\n【后文结束】" in messages[1]["content"]
    assert "<f1-2e5/>" not in messages[1]["content"]
    assert "<f2-9ad/>" not in messages[1]["content"]


def test_build_single_item_fallback_messages_plain_text_has_no_json_contract_conflict() -> None:
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_messages(
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
    messages = prompt_building.build_messages(
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
    assert "公式一律用 LaTeX 写在 `$...$` 里" in system_prompt
    # 渲染器读的是 LaTeX，提示词必须明说别转 Typst——历史上这里含糊过，
    # 模型就真的开始吐 Typst 语法。
    assert "不要改写成 Typst 语法" in system_prompt
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    assert "公式一律用 LaTeX 写在 `$...$` 里" in system_prompt
    # 渲染器读的是 LaTeX，提示词必须明说别转 Typst——历史上这里含糊过，
    # 模型就真的开始吐 Typst 语法。
    assert "不要改写成 Typst 语法" in system_prompt
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
    messages = prompt_building.build_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    assert "直接输出【当前原文】的英文译文" in combined_prompt
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
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
    messages = prompt_building.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": r"标记 $\circled{A}$ 与 $x$。",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
    )
    user_prompt = messages[1]["content"]
    assert "渲染器不支持" in user_prompt
    assert r"`\circled`" in user_prompt
    # 数据库里有但本段没出现的命令,不应进提示词
    assert r"\textcircled" not in user_prompt


def test_direct_typst_single_prompt_no_longer_asks_to_degrade_supported_commands() -> None:
    """mitex 0.2.7 能渲染的命令不该再出现在替换提示里。

    这条提示是逐条注入到每个待翻译条目的,是整条链路上最早、也最难追查的降级点:
    模型照做之后,译文里存下来的就已经是 `ℏ` 而不是 `\hbar`,后面任何环节都救不回来。
    """
    messages = prompt_building.build_single_item_fallback_messages(
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
    assert "渲染器不支持" not in user_prompt
    for degraded in ("ℏ", "∂", "⟨", "⟩", r"\Phi"):
        assert degraded not in user_prompt


def test_direct_typst_single_prompt_has_no_rewrite_hint_for_clean_source() -> None:
    messages = prompt_building.build_single_item_fallback_messages(
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


def test_context_bleed_downgraded_to_warning_for_continuation_items() -> None:
    from retainpdf_translation.llm.validation.quality import review_translation_item

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
    messages = prompt_building.build_single_item_fallback_messages(
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


def test_single_prompt_puts_context_first_and_answer_instruction_last() -> None:
    # 20261014032006-e2f12c p006-b009：作答要求夹在中间、原文后面跟着「前文上下文：……」「后文上下文：……」，
    # 读完没有一处说「下面就是回答」，模型照着格式自己补了个「译文：」再写译文。
    for math_mode in ("direct_typst", "placeholder"):
        messages = prompt_building.build_single_item_fallback_messages(
            {
                "item_id": "p006-b009",
                "protected_source_text": "whereas the experimental value of the ionization energy is 0.9033 Eh",
                "translation_context_before": "The exact energy of the hydrogen atom is -0.5 Eh,",
                "translation_context_after": "Example 9-2 illustrates another shortcoming.",
                "math_mode": math_mode,
                "metadata": {"structure_role": "body"},
            },
            mode="sci",
            response_style="plain_text",
        )
        user_prompt = messages[1]["content"]
        before = user_prompt.index("The exact energy of the hydrogen atom")
        after = user_prompt.index("Example 9-2 illustrates")
        source_start = user_prompt.index("【当前原文开始】")
        source_end = user_prompt.index("【当前原文结束】")
        assert before < source_start and after < source_start, math_mode
        tail = user_prompt[source_end:]
        assert "上下文（" not in tail and "【前文" not in tail and "【后文" not in tail, math_mode
        assert user_prompt.splitlines()[-1].startswith("现在直接输出【当前原文】的简体中文译文。"), math_mode
