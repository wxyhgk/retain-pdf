from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt


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
        return "Sự phát triển của các chương trình máy tính phức tạp."

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."


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
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."
    assert result["p001-b002"]["translated_text"] == "Khả năng tính toán nhanh hơn cải thiện mô phỏng."


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
          translated_text: "Câu này bắt đầu và tiếp tục.",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "Câu này bắt đầu"},
            {"item_id": "p010-b002", "translated_text": "và tiếp tục."},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Câu này bắt đầu và tiếp tục."
    assert payload["member_translations"][1]["translated_text"] == "và tiếp tục."


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
    assert "<<<ITEM item_id=" in messages[0]["content"]
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
        == "Chỉ để hiểu, cấm dịch vào đầu ra: evidence against a catalytic cycle and reaction pathway"
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
    assert "Văn bản gốc hiện tại là đoạn không hoàn chỉnh; bản dịch phải giữ nguyên sự không hoàn chỉnh, không dùng ngữ cảnh phía sau để bổ sung." in messages[1]["content"]
    assert "Ngữ cảnh phía sau (chỉ để hiểu, cấm dịch vào đầu ra): evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
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

    assert "Return only the translation, using plain text." in system_prompt
    assert "Do not output placeholders, structured data, tags, code blocks or explanations" in system_prompt
    assert "Chỉ đầu ra hợp lệ phù hợp với cấu trúc sau khi trả về kết quả JSON" not in system_prompt
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

    assert "【Bắt đầu văn bản gốc hiện tại】" in messages[1]["content"]
    assert "【Kết thúc văn bản gốc hiện tại】" in messages[1]["content"]
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
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
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

    assert "Đừng chỉ dựa vào OCR" not in combined_prompt
    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in combined_prompt
    assert "Vui lòng trả lại nguyên trạng" not in combined_prompt
    assert "Nguyên văn được giữ lại một phần nguyên văn" in combined_prompt


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

    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in messages[0]["content"]
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "proactively wrap it in `$...$`"

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt


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
        return "Sự phát triển của các chương trình máy tính phức tạp."

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."


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
            "<<<ITEM item_id=p001-b001>>>\nPhát triển các chương trình máy tính phức tạp。\n<<<END>>>\n"
            "<<<ITEM item_id=p001-b002>>>\nTốc độ băm nhanh hơn giúp cải thiện mô phỏng。\n<<<END>>>"
        )

    with mock.patch.object(translation_client, "build_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_batch_once(batch, mode="fast")

    assert captured["response_style"] == "tagged"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."
    assert result["p001-b002"]["translated_text"] == "Khả năng tính toán nhanh hơn cải thiện mô phỏng."


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
          translated_text: "Câu này bắt đầu và tiếp tục.",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "Câu này bắt đầu"},
            {"item_id": "p010-b002", "translated_text": "và tiếp tục."},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Câu này bắt đầu và tiếp tục."
    assert payload["member_translations"][1]["translated_text"] == "và tiếp tục."


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
    assert "<<<ITEM item_id=" in messages[0]["content"]
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
        == "Chỉ để hiểu, cấm dịch vào đầu ra: evidence against a catalytic cycle and reaction pathway"
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
    assert "Văn bản gốc hiện tại là đoạn không hoàn chỉnh; bản dịch phải giữ nguyên sự không hoàn chỉnh, không dùng ngữ cảnh phía sau để bổ sung." in messages[1]["content"]
    assert "Ngữ cảnh phía sau (chỉ để hiểu, cấm dịch vào đầu ra): evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
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

    assert "Return only the translation, using plain text." in system_prompt
    assert "Do not output placeholders, structured data, tags, code blocks or explanations" in system_prompt
    assert "Chỉ đầu ra hợp lệ phù hợp với cấu trúc sau khi trả về kết quả JSON" not in system_prompt
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

    assert "【Bắt đầu văn bản gốc hiện tại】" in messages[1]["content"]
    assert "【Kết thúc văn bản gốc hiện tại】" in messages[1]["content"]
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
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
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

    assert "Đừng chỉ dựa vào OCR" not in combined_prompt
    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in combined_prompt
    assert "Vui lòng trả lại nguyên trạng" not in combined_prompt
    assert "Nguyên văn được giữ lại một phần nguyên văn" in combined_prompt


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

    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in messages[0]["content"]
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "Do not leave bare LaTeX-style math fragments" in system_prompt
    assert "use a single backslash for LaTeX commands" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # khoảng thời gian、kề sát、Các quy tắc định dạng cơ học như dấu gạch chéo ngược kép được xác định bởi normalize_direct_typst_translation
    # Hài hòa khi dịch,Không sử dụng lời nhắc nữa。
    assert "Không gian tách biệt" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode superscript characters" in system_prompt
    assert "$^{{117}}$" in system_prompt
    assert "$^{{26-28}}$" in system_prompt
    assert "apply a minimal semantic repair" in system_prompt
    assert "Do not fill in missing body content" in system_prompt
    assert "<<<ITEM item_id=" in system_prompt
    assert "Vui lòng xuất một khối được gắn thẻ cho mỗi đoạn" in user_prompt
    assert "Không ghi lại số thứ tự, trường quyết định, dữ liệu có cấu trúc hoặc thẻ" not in user_prompt
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "proactively wrap it in `$...$`"

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt


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
        return "Sự phát triển của các chương trình máy tính phức tạp."

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."


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
            "<<<ITEM item_id=p001-b001>>>\nPhát triển các chương trình máy tính phức tạp。\n<<<END>>>\n"
            "<<<ITEM item_id=p001-b002>>>\nTốc độ băm nhanh hơn giúp cải thiện mô phỏng。\n<<<END>>>"
        )

    with mock.patch.object(translation_client, "build_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_batch_once(batch, mode="fast")

    assert captured["response_style"] == "tagged"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."
    assert result["p001-b002"]["translated_text"] == "Khả năng tính toán nhanh hơn cải thiện mô phỏng."


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
          translated_text: "Câu này bắt đầu và tiếp tục.",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "Câu này bắt đầu"},
            {"item_id": "p010-b002", "translated_text": "và tiếp tục."},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Câu này bắt đầu và tiếp tục."
    assert payload["member_translations"][1]["translated_text"] == "và tiếp tục."


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
    assert "<<<ITEM item_id=" in messages[0]["content"]
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
        == "Chỉ để hiểu, cấm dịch vào đầu ra: evidence against a catalytic cycle and reaction pathway"
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
    assert "Văn bản gốc hiện tại là đoạn không hoàn chỉnh; bản dịch phải giữ nguyên sự không hoàn chỉnh, không dùng ngữ cảnh phía sau để bổ sung." in messages[1]["content"]
    assert "Ngữ cảnh phía sau (chỉ để hiểu, cấm dịch vào đầu ra): evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
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

    assert "Return only the translation, using plain text." in system_prompt
    assert "Do not output placeholders, structured data, tags, code blocks or explanations" in system_prompt
    assert "Chỉ đầu ra hợp lệ phù hợp với cấu trúc sau khi trả về kết quả JSON" not in system_prompt
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

    assert "【Bắt đầu văn bản gốc hiện tại】" in messages[1]["content"]
    assert "【Kết thúc văn bản gốc hiện tại】" in messages[1]["content"]
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
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
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

    assert "Đừng chỉ dựa vào OCR" not in combined_prompt
    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in combined_prompt
    assert "Vui lòng trả lại nguyên trạng" not in combined_prompt
    assert "Nguyên văn được giữ lại một phần nguyên văn" in combined_prompt


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

    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in messages[0]["content"]
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "Vui lòng chủ động sử dụng `$...$` Gói" in system_prompt
    assert "use a single backslash for LaTeX commands" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # khoảng thời gian、kề sát、Các quy tắc định dạng cơ học như dấu gạch chéo ngược kép được xác định bởi normalize_direct_typst_translation
    # Hài hòa khi dịch,Không sử dụng lời nhắc nữa。
    assert "Không gian tách biệt" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode superscript characters" in system_prompt
    assert "$^{{117}}$" in system_prompt
    assert "$^{{26-28}}$" in system_prompt
    assert "apply a minimal semantic repair" in system_prompt
    assert "Do not fill in missing body content" in system_prompt
    assert "<<<ITEM item_id=" in system_prompt
    assert "Vui lòng xuất một khối được gắn thẻ cho mỗi đoạn" in user_prompt
    assert "Không ghi lại số thứ tự, trường quyết định, dữ liệu có cấu trúc hoặc thẻ" not in user_prompt
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "Do not leave bare LaTeX-style math fragments" in system_prompt
    assert "use a single backslash for LaTeX commands" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # khoảng thời gian、kề sát、Các quy tắc định dạng cơ học như dấu gạch chéo ngược kép được xác định bởi normalize_direct_typst_translation
    # Hài hòa khi dịch,Không sử dụng lời nhắc nữa。
    assert "Không gian tách biệt" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode superscript characters" in system_prompt
    assert "$^{{117}}$" in system_prompt
    assert "$^{{26-28}}$" in system_prompt
    assert "apply a minimal semantic repair" in system_prompt
    assert "Do not fill in missing body content" in system_prompt
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

    assert "Mẹo kết cấu：Văn bản nguồn hiện tại là một khối cấu trúc nhiều dòng" not in messages[1]["content"]
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

    assert "Table of Contents / List of Tables" in prompt
    assert "Mỗi dòng văn bản gốc xuất một dòng bản dịch" in prompt
    assert "Dịch thẻ đầu dòng và tiêu đề" in prompt
    assert "Giữ số trang cuối dòng" in prompt


def test_prompt_builder_can_render_non_default_target_language() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": "Giữ thuật ngữ chính xác。",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
        target_language_name="English",
    )
    combined_prompt = "\n".join(message["content"] for message in messages)

    assert "English for Essay Typography" in combined_prompt
    assert "Đầu ra trực tiếp của bản dịch tiếng Anh" in combined_prompt
    assert "Phần thân của bản dịch tiếng Anh cuối cùng" in combined_prompt
    assert "Tiếng Trung giản thể cho Typography Tiểu luận" not in combined_prompt


def test_parse_translation_payload_accepts_well_formed_tagged_blocks() -> None:
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n<<<END>>>\n"
        "<<<ITEM item_id=b decision=keep_origin>>>\n\n<<<END>>>\n"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Translation A"
    assert result["b"]["decision"] == "keep_origin"


def test_parse_translation_payload_recovers_item_with_damaged_trailing_end_tag() -> None:
    # Mô hình Sự cố Thực sự(job ffc511 batch 2/8):Khi kết thúc đầu ra, mô hình <<<END>>>
    # đánh thành <<<END>>,Ít hơn một >。Nội dung còn nguyên vẹn,Không cho phép các mục nhập bị mất。
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n<<<END>>>\n"
        "<<<ITEM item_id=b>>>\n译文B,Bao gồm các công thức $x^2$。\n<<<END>>"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Translation A"
    assert result["b"]["translated_text"] == "Bản dịch B, bao gồm công thức $x^2$."


def test_parse_translation_payload_treats_next_open_tag_as_implicit_close() -> None:
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n"
        "<<<ITEM item_id=b>>>\n译文B\n<<<END>>>"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Translation A"
    assert result["b"]["translated_text"] == "译文B"


def test_parse_translation_payload_does_not_cut_literal_end_text_mid_content() -> None:
    content = "<<<ITEM item_id=a>>>\nĐề cập đến đoạn END Từ và <đánh dấu> Ký hiệu。\n<<<END>>>"
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Đoạn văn đề cập đến từ END và ký hiệu <đánh dấu>."


def test_direct_typst_single_prompt_warns_model_about_unbalanced_source_dollars() -> None:
    # Source text $ Là Lẻ(OCR Trận thua $)thì,Trong thông báo người dùng, trước tiên hãy nhắc mô hình nhấn
    # Sửa chữa ngữ nghĩa,thay vì đưa trực tiếp vào mô hình để tạo ra các bản dịch không cân bằng không thể tránh khỏi。
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
    assert "Số lượng dấu phân cách toán học `from __future__ import annotations"

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt


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
        return "Sự phát triển của các chương trình máy tính phức tạp."

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."


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
            "<<<ITEM item_id=p001-b001>>>\nPhát triển các chương trình máy tính phức tạp。\n<<<END>>>\n"
            "<<<ITEM item_id=p001-b002>>>\nTốc độ băm nhanh hơn giúp cải thiện mô phỏng。\n<<<END>>>"
        )

    with mock.patch.object(translation_client, "build_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_batch_once(batch, mode="fast")

    assert captured["response_style"] == "tagged"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."
    assert result["p001-b002"]["translated_text"] == "Khả năng tính toán nhanh hơn cải thiện mô phỏng."


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
          translated_text: "Câu này bắt đầu và tiếp tục.",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "Câu này bắt đầu"},
            {"item_id": "p010-b002", "translated_text": "và tiếp tục."},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Câu này bắt đầu và tiếp tục."
    assert payload["member_translations"][1]["translated_text"] == "và tiếp tục."


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
    assert "<<<ITEM item_id=" in messages[0]["content"]
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
        == "Chỉ để hiểu, cấm dịch vào đầu ra: evidence against a catalytic cycle and reaction pathway"
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
    assert "Văn bản gốc hiện tại là đoạn không hoàn chỉnh; bản dịch phải giữ nguyên sự không hoàn chỉnh, không dùng ngữ cảnh phía sau để bổ sung." in messages[1]["content"]
    assert "Ngữ cảnh phía sau (chỉ để hiểu, cấm dịch vào đầu ra): evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
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

    assert "Return only the translation, using plain text." in system_prompt
    assert "Do not output placeholders, structured data, tags, code blocks or explanations" in system_prompt
    assert "Chỉ đầu ra hợp lệ phù hợp với cấu trúc sau khi trả về kết quả JSON" not in system_prompt
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

    assert "【Bắt đầu văn bản gốc hiện tại】" in messages[1]["content"]
    assert "【Kết thúc văn bản gốc hiện tại】" in messages[1]["content"]
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
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
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

    assert "Đừng chỉ dựa vào OCR" not in combined_prompt
    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in combined_prompt
    assert "Vui lòng trả lại nguyên trạng" not in combined_prompt
    assert "Nguyên văn được giữ lại một phần nguyên văn" in combined_prompt


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

    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in messages[0]["content"]
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "proactively wrap it in `$...$`"

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt


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
        return "Sự phát triển của các chương trình máy tính phức tạp."

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."


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
            "<<<ITEM item_id=p001-b001>>>\nPhát triển các chương trình máy tính phức tạp。\n<<<END>>>\n"
            "<<<ITEM item_id=p001-b002>>>\nTốc độ băm nhanh hơn giúp cải thiện mô phỏng。\n<<<END>>>"
        )

    with mock.patch.object(translation_client, "build_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_batch_once(batch, mode="fast")

    assert captured["response_style"] == "tagged"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."
    assert result["p001-b002"]["translated_text"] == "Khả năng tính toán nhanh hơn cải thiện mô phỏng."


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
          translated_text: "Câu này bắt đầu và tiếp tục.",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "Câu này bắt đầu"},
            {"item_id": "p010-b002", "translated_text": "và tiếp tục."},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Câu này bắt đầu và tiếp tục."
    assert payload["member_translations"][1]["translated_text"] == "và tiếp tục."


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
    assert "<<<ITEM item_id=" in messages[0]["content"]
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
        == "Chỉ để hiểu, cấm dịch vào đầu ra: evidence against a catalytic cycle and reaction pathway"
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
    assert "Văn bản gốc hiện tại là đoạn không hoàn chỉnh; bản dịch phải giữ nguyên sự không hoàn chỉnh, không dùng ngữ cảnh phía sau để bổ sung." in messages[1]["content"]
    assert "Ngữ cảnh phía sau (chỉ để hiểu, cấm dịch vào đầu ra): evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
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

    assert "Return only the translation, using plain text." in system_prompt
    assert "Do not output placeholders, structured data, tags, code blocks or explanations" in system_prompt
    assert "Chỉ đầu ra hợp lệ phù hợp với cấu trúc sau khi trả về kết quả JSON" not in system_prompt
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

    assert "【Bắt đầu văn bản gốc hiện tại】" in messages[1]["content"]
    assert "【Kết thúc văn bản gốc hiện tại】" in messages[1]["content"]
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
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
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

    assert "Đừng chỉ dựa vào OCR" not in combined_prompt
    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in combined_prompt
    assert "Vui lòng trả lại nguyên trạng" not in combined_prompt
    assert "Nguyên văn được giữ lại một phần nguyên văn" in combined_prompt


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

    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in messages[0]["content"]
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "Do not leave bare LaTeX-style math fragments" in system_prompt
    assert "use a single backslash for LaTeX commands" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # khoảng thời gian、kề sát、Các quy tắc định dạng cơ học như dấu gạch chéo ngược kép được xác định bởi normalize_direct_typst_translation
    # Hài hòa khi dịch,Không sử dụng lời nhắc nữa。
    assert "Không gian tách biệt" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode superscript characters" in system_prompt
    assert "$^{{117}}$" in system_prompt
    assert "$^{{26-28}}$" in system_prompt
    assert "apply a minimal semantic repair" in system_prompt
    assert "Do not fill in missing body content" in system_prompt
    assert "<<<ITEM item_id=" in system_prompt
    assert "Vui lòng xuất một khối được gắn thẻ cho mỗi đoạn" in user_prompt
    assert "Không ghi lại số thứ tự, trường quyết định, dữ liệu có cấu trúc hoặc thẻ" not in user_prompt
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "proactively wrap it in `$...$`"

import json
import sys
from pathlib import Path
from unittest import mock


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.llm.providers.deepseek import client as deepseek_client
from services.translation.llm.providers.deepseek import translation_client
from services.translation.core.context import build_item_context
from services.translation.llm.shared.prompt_protocols import group_member_json_user_prompt


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
        return "Sự phát triển của các chương trình máy tính phức tạp."

    with mock.patch.object(translation_client, "build_single_item_fallback_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_single_item_plain_text(item)

    assert captured["response_style"] == "plain_text"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."


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
            "<<<ITEM item_id=p001-b001>>>\nPhát triển các chương trình máy tính phức tạp。\n<<<END>>>\n"
            "<<<ITEM item_id=p001-b002>>>\nTốc độ băm nhanh hơn giúp cải thiện mô phỏng。\n<<<END>>>"
        )

    with mock.patch.object(translation_client, "build_messages", side_effect=_fake_messages), mock.patch.object(
        translation_client, "request_chat_content", side_effect=_fake_request
    ):
        result = translation_client.translate_batch_once(batch, mode="fast")

    assert captured["response_style"] == "tagged"
    assert captured["response_format"] is None
    assert result["p001-b001"]["translated_text"] == "Sự phát triển của các chương trình máy tính phức tạp."
    assert result["p001-b002"]["translated_text"] == "Khả năng tính toán nhanh hơn cải thiện mô phỏng."


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
          translated_text: "Câu này bắt đầu và tiếp tục.",
          member_translations: [
            {"item_id": "p010-b001", "translated_text": "Câu này bắt đầu"},
            {"item_id": "p010-b002", "translated_text": "và tiếp tục."},
          ],
        }
        """

    with mock.patch.object(translation_client, "request_chat_content", side_effect=_fake_request):
        result = translation_client.translate_continuation_group_members(item)

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Câu này bắt đầu và tiếp tục."
    assert payload["member_translations"][1]["translated_text"] == "và tiếp tục."


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
    assert "<<<ITEM item_id=" in messages[0]["content"]
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
        == "Chỉ để hiểu, cấm dịch vào đầu ra: evidence against a catalytic cycle and reaction pathway"
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
    assert "Văn bản gốc hiện tại là đoạn không hoàn chỉnh; bản dịch phải giữ nguyên sự không hoàn chỉnh, không dùng ngữ cảnh phía sau để bổ sung." in messages[1]["content"]
    assert "Ngữ cảnh phía sau (chỉ để hiểu, cấm dịch vào đầu ra): evidence against a catalytic cycle and reaction pathway" in messages[1]["content"]
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

    assert "Return only the translation, using plain text." in system_prompt
    assert "Do not output placeholders, structured data, tags, code blocks or explanations" in system_prompt
    assert "Chỉ đầu ra hợp lệ phù hợp với cấu trúc sau khi trả về kết quả JSON" not in system_prompt
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

    assert "【Bắt đầu văn bản gốc hiện tại】" in messages[1]["content"]
    assert "【Kết thúc văn bản gốc hiện tại】" in messages[1]["content"]
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
    assert payload["output_schema"]["member_translations"][0]["item_id"] == "member id from member_ids"
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

    assert "Đừng chỉ dựa vào OCR" not in combined_prompt
    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in combined_prompt
    assert "Vui lòng trả lại nguyên trạng" not in combined_prompt
    assert "Nguyên văn được giữ lại một phần nguyên văn" in combined_prompt


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

    assert "Mã độc lập、mệnh lệnh、phối trí、Táº­p tin nháº­p、Danh sách tập tin hoặc cây thư mục" not in messages[0]["content"]
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "Vui lòng chủ động sử dụng `$...$` Gói" in system_prompt
    assert "use a single backslash for LaTeX commands" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # khoảng thời gian、kề sát、Các quy tắc định dạng cơ học như dấu gạch chéo ngược kép được xác định bởi normalize_direct_typst_translation
    # Hài hòa khi dịch,Không sử dụng lời nhắc nữa。
    assert "Không gian tách biệt" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode superscript characters" in system_prompt
    assert "$^{{117}}$" in system_prompt
    assert "$^{{26-28}}$" in system_prompt
    assert "apply a minimal semantic repair" in system_prompt
    assert "Do not fill in missing body content" in system_prompt
    assert "<<<ITEM item_id=" in system_prompt
    assert "Vui lòng xuất một khối được gắn thẻ cho mỗi đoạn" in user_prompt
    assert "Không ghi lại số thứ tự, trường quyết định, dữ liệu có cấu trúc hoặc thẻ" not in user_prompt
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
    assert "The direct_typst formula passthrough mode is enabled." in system_prompt
    assert "First understand the semantics of the whole sentence" in system_prompt
    assert "Do not leave bare LaTeX-style math fragments" in system_prompt
    assert "use a single backslash for LaTeX commands" in system_prompt
    assert r"\mathrm{M}" in system_prompt
    # khoảng thời gian、kề sát、Các quy tắc định dạng cơ học như dấu gạch chéo ngược kép được xác định bởi normalize_direct_typst_translation
    # Hài hòa khi dịch,Không sử dụng lời nhắc nữa。
    assert "Không gian tách biệt" not in system_prompt
    assert "$...$$...$" not in system_prompt
    assert r"\\text{g}" not in system_prompt
    assert r"\cite{117}" in system_prompt
    assert "Unicode superscript characters" in system_prompt
    assert "$^{{117}}$" in system_prompt
    assert "$^{{26-28}}$" in system_prompt
    assert "apply a minimal semantic repair" in system_prompt
    assert "Do not fill in missing body content" in system_prompt
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

    assert "Mẹo kết cấu：Văn bản nguồn hiện tại là một khối cấu trúc nhiều dòng" not in messages[1]["content"]
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

    assert "Table of Contents / List of Tables" in prompt
    assert "Mỗi dòng văn bản gốc xuất một dòng bản dịch" in prompt
    assert "Dịch thẻ đầu dòng và tiêu đề" in prompt
    assert "Giữ số trang cuối dòng" in prompt


def test_prompt_builder_can_render_non_default_target_language() -> None:
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": "Giữ thuật ngữ chính xác。",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
        },
        mode="sci",
        response_style="plain_text",
        target_language_name="English",
    )
    combined_prompt = "\n".join(message["content"] for message in messages)

    assert "English for Essay Typography" in combined_prompt
    assert "Đầu ra trực tiếp của bản dịch tiếng Anh" in combined_prompt
    assert "Phần thân của bản dịch tiếng Anh cuối cùng" in combined_prompt
    assert "Tiếng Trung giản thể cho Typography Tiểu luận" not in combined_prompt


def test_parse_translation_payload_accepts_well_formed_tagged_blocks() -> None:
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n<<<END>>>\n"
        "<<<ITEM item_id=b decision=keep_origin>>>\n\n<<<END>>>\n"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Translation A"
    assert result["b"]["decision"] == "keep_origin"


def test_parse_translation_payload_recovers_item_with_damaged_trailing_end_tag() -> None:
    # Mô hình Sự cố Thực sự(job ffc511 batch 2/8):Khi kết thúc đầu ra, mô hình <<<END>>>
    # đánh thành <<<END>>,Ít hơn một >。Nội dung còn nguyên vẹn,Không cho phép các mục nhập bị mất。
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n<<<END>>>\n"
        "<<<ITEM item_id=b>>>\n译文B,Bao gồm các công thức $x^2$。\n<<<END>>"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Translation A"
    assert result["b"]["translated_text"] == "Bản dịch B, bao gồm công thức $x^2$."


def test_parse_translation_payload_treats_next_open_tag_as_implicit_close() -> None:
    content = (
        "<<<ITEM item_id=a>>>\n译文A\n"
        "<<<ITEM item_id=b>>>\n译文B\n<<<END>>>"
    )
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Translation A"
    assert result["b"]["translated_text"] == "译文B"


def test_parse_translation_payload_does_not_cut_literal_end_text_mid_content() -> None:
    content = "<<<ITEM item_id=a>>>\nĐề cập đến đoạn END Từ và <đánh dấu> Ký hiệu。\n<<<END>>>"
    result = translation_client.parse_translation_payload(content)
    assert result["a"]["translated_text"] == "Đoạn văn đề cập đến từ END và ký hiệu <đánh dấu>."


def test_direct_typst_single_prompt_warns_model_about_unbalanced_source_dollars() -> None:
    # Source text $ Là Lẻ(OCR Trận thua $)thì,Trong thông báo người dùng, trước tiên hãy nhắc mô hình nhấn
    # Sửa chữa ngữ nghĩa,thay vì đưa trực tiếp vào mô hình để tạo ra các bản dịch không cân bằng không thể tránh khỏi。
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
    assert "is an odd number of" in messages[1]["content"]


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
    assert "Dấu phân cách toán học" not in messages[1]["content"]


def test_direct_typst_single_prompt_lists_mitex_rewrites_found_in_source() -> None:
    # Mẹo dựa trên dữ liệu:Khi công thức nguồn khớp với một mục nhập cơ sở dữ liệu,Viết thay thế cần thiết vào lời nhắc,
    # Thay thế được thực hiện bởi mô hình ở cấp độ ngữ nghĩa——Viết lại thường xuyên trong các công thức phức tạp là không đáng tin cậy。
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
    assert "Trình kết xuất không hỗ trợ" in user_prompt
    assert r"Thay `\\hbar` bằng `ℏ`" in user_prompt
    assert r"Thay `\\varPhi` bằng `\\Phi`" in user_prompt
    assert r"Thay `\\rangle` bằng `⟩`" in user_prompt
    # Có những lệnh trong cơ sở dữ liệu không xuất hiện trong đoạn này,Không nên nhập các từ nhắc nhở
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
    assert "Trình kết xuất không hỗ trợ" not in messages[1]["content"]


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
    # Thiếu trước đây member id sẽ âm thầm thoái hóa thành phân đoạn hình học;Thử lại ngay,Lần 02:
    # Phân đoạn có cấu trúc khi trở về trạng thái đầy đủ。
    responses = iter([
        json.dumps({
            "translated_text": "Năng lượng $E = mc^2$ Bắt đầu và tiếp tục tại đây。",
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": "Năng lượng $E = mc^2$ Bắt đầu"},
            ],
        }, ensure_ascii=False),
        json.dumps({
            "translated_text": "Năng lượng $E = mc^2$ Bắt đầu và tiếp tục tại đây。",
            "member_translations": [
                {"item_id": "p010-b001", "translated_text": "Năng lượng $E = mc^2$ Bắt đầu"},
                {"item_id": "p010-b002", "translated_text": "và tiếp tục ở đây。"},
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


def test_group_members_drops_splits_when_member_math_stays_unbalanced() -> None:
    # Nhịp phương trình member cắt ra:chỉnh thể $ Các số lẻ và số chẵn là chính xác,Nhưng theo đuổi member Tất cả đều tệ.。
    # Nếu nó vẫn xấu sau khi thử lại, hãy loại bỏ nó member Split(Đi bộ rõ ràng trong túi sau hình học),Lưu giữ bản dịch tổng thể。
    bad = json.dumps({
        "translated_text": "Năng lượng $E = mc^2$ Bắt đầu và tiếp tục tại đây。",
        "member_translations": [
            {"item_id": "p010-b001", "translated_text": "Năng lượng $E = mc^2 Bắt đầu"},
            {"item_id": "p010-b002", "translated_text": "$ và tiếp tục ở đây。"},
        ],
    }, ensure_ascii=False)

    with mock.patch.object(translation_client, "request_chat_content", return_value=bad):
        result = translation_client.translate_continuation_group_members(_cg_item())

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Năng lượng $E = mc^2$ Bắt đầu và tiếp tục tại đây。"
    assert payload["member_translations"] == []


def test_group_members_salvages_aggregate_text_from_broken_json() -> None:
    # LaTeX Backslash thoát khỏi thiệt hại gây ra bởi JSON Không thể phân tích cú pháp:Sau khi cả hai vòng giải quyết không thành công,
    # cấp cứu translated_text Chuỗi,Không còn toàn bộ đoạn văn bị loại bỏ。
    broken = (
        '{"translated_text": "Ở đây tiếp tục bảo tồn năng lượng。",\n'
        '"member_translations": [{"item_id": "p010-b001", "translated_text": "Năng lượng $\\alpha Bảo tồn"'
    )

    with mock.patch.object(translation_client, "request_chat_content", return_value=broken):
        result = translation_client.translate_continuation_group_members(_cg_item())

    payload = result["__cg__:cg-010-001"]
    assert payload["translated_text"] == "Ở đây tiếp tục bảo tồn năng lượng。"
    assert payload["member_translations"] == []


def test_context_bleed_downgraded_to_warning_for_continuation_items() -> None:
    from services.translation.llm.validation.quality import review_translation_item

    # Các phân đoạn tuần tự được thiết kế không có dấu chấm câu kết thúc,Rò rỉ công thức sau đây từ apply Cắt tỉa cơ học lớp,
    # Không nên kích hoạt thử lại mức độ lỗi tốn kém。
    item = {
        "item_id": "p001-b001",
        "protected_source_text": "the reaction rate depends on",
        "continuation_group": "cg-001",
        "translation_context_after": "the constant $k = A e^{-E_a/RT}$ as shown",
        "math_mode": "direct_typst",
        "block_type": "text",
        "metadata": {"structure_role": "body"},
    }
    report = review_translation_item(item, {"decision": "translate", "translated_text": "Tốc độ phản ứng phụ thuộc vào hằng số $k = A e^{-E_a/RT}$"})
    bleed = [i for i in report.issues if i.kind == "context_bleed"]
    assert bleed and bleed[0].severity == "warning"

    standalone = dict(item)
    standalone.pop("continuation_group")
    report2 = review_translation_item(standalone, {"decision": "translate", "translated_text": "Tốc độ phản ứng phụ thuộc vào hằng số $k = A e^{-E_a/RT}$"})
    bleed2 = [i for i in report2.issues if i.kind == "context_bleed"]
    assert bleed2 and bleed2[0].severity == "error"


def test_direct_typst_single_prompt_moves_scoped_terms_into_user_message() -> None:
    # Từ vựng là các mục khác nhau theo từng mục sau khi khớp theo từng mục,thả system sẽ loại bỏ bộ nhớ đệm tiền tố;
    # Meridian thuật ngữ phù hợp item rót vào user tin tức。
    messages = deepseek_client.build_single_item_fallback_messages(
        {
            "item_id": "p001-b001",
            "protected_source_text": "The SCF procedure converges quickly.",
            "math_mode": "direct_typst",
            "metadata": {"structure_role": "body"},
            "_scoped_terms_guidance": "SCF => trường tự hợp",
        },
        mode="sci",
        response_style="plain_text",
    )
    assert "SCF => trường tự hợp" not in messages[0]["content"]
    assert "Terminology requirements:" in messages[1]["content"]
    assert "SCF => trường tự hợp" in messages[1]["content"]
