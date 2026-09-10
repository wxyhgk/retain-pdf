import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.prompts import (
    build_operation_system_prompt,
    build_reading_system_prompt,
)


def test_reading_prompt_prefers_relevant_controlled_images_without_hallucinating_urls():
    prompt = build_reading_system_prompt()

    assert "默认选 1–3 张" in prompt
    assert "工具返回的原始 image_url" in prompt
    assert "不得猜测、拼接或改写 URL" in prompt
    assert "没有相关受控" in prompt and "正常使用纯文字" in prompt
    assert "只有用户要求展示原图时" not in prompt


def test_operation_prompt_adds_visual_guidance_only_when_reading_is_available():
    common = {
        "document_id": "doc-1",
        "conversation_id": "conv-1",
        "tools_available": True,
        "confirmation_mode": "explicit",
        "confirmed": False,
        "operations": [],
    }

    reading_prompt = build_operation_system_prompt(**common, reading_available=True)
    operation_only_prompt = build_operation_system_prompt(**common, reading_available=False)

    assert "默认选 1–3 张" in reading_prompt
    assert "不得猜测 URL" in reading_prompt
    assert "默认选 1–3 张" not in operation_only_prompt
