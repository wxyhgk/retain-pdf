"""接线：核心抄的取 JSON 函数和翻译底座的一样；接线的模型调用回核心的 ChatResult；定结构的请求带截图、标签另记。
要装 [engine]（翻译底座）。"""
from __future__ import annotations

import pytest

pytest.importorskip("retainpdf_translation")

from retainpdf_translation.llm.shared.response_parsing import extract_json_text as base_extract  # noqa: E402

import retainpdf_table_agent_engine.llm as engine_llm  # noqa: E402
from retainpdf_table_agent import ChatResult  # noqa: E402
from retainpdf_table_agent.json_text import extract_json_text as core_extract  # noqa: E402

SAMPLES = [
    '{"action": "submit", "cells": {"r1c1": "温度"}}',
    '```json\n{"action": "lookup_terms", "terms": ["yield"]}\n```',
    '好的，结果如下：{"action": "submit", "cells": {"r0c0": "样品"}} 以上。',
    '{"action": "submit", "cells": {"r2c1": "$\\beta$ 值"}}',
    '{“action”： “submit”, “cells”： {“r1c0”： “压力”}}',
    '"translations": {"a": "b"}',
    '{"text": "Vue’s 组件「注：」"}',
]


@pytest.mark.parametrize("reply", SAMPLES)
def test_core_json_extraction_matches_the_base(reply: str) -> None:
    assert core_extract(reply) == base_extract(reply)


def test_no_json_raises_in_both() -> None:
    for extract in (core_extract, base_extract):
        with pytest.raises(ValueError):
            extract("没有 JSON")


def test_chat_fn_returns_the_core_chat_result(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(engine_llm, "request_chat_content", lambda messages, **kwargs: '{"action": "submit", "cells": {}}')
    monkeypatch.setattr(engine_llm, "raise_if_credential_rejected", lambda *args, **kwargs: None)
    chat = engine_llm.table_chat_fn(model="m", base_url="http://127.0.0.1:9", api_key="k")
    result = chat([{"role": "user", "content": "表"}], purpose="table_translate", response_format={"type": "json_object"})
    assert isinstance(result, ChatResult)
    assert result.content == '{"action": "submit", "cells": {}}'


def test_structure_requests_carry_their_own_label(monkeypatch: pytest.MonkeyPatch) -> None:
    labels = []
    monkeypatch.setattr(engine_llm, "request_chat_content", lambda messages, **kwargs: labels.append(kwargs["request_label"]) or "{}")
    monkeypatch.setattr(engine_llm, "raise_if_credential_rejected", lambda *args, **kwargs: None)
    chat = engine_llm.table_chat_fn(model="m", base_url="http://127.0.0.1:9", api_key="k")
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}
    chat([{"role": "user", "content": [image, {"type": "text", "text": "表"}]}], purpose="table_structure")
    chat([{"role": "user", "content": "表"}], purpose="table_translate")
    assert labels == ["table-translate-structure", "table-translate"]
    from retainpdf_base.usage_ledger import usage_stage

    assert {usage_stage(label) for label in labels} == {"table_translation"}, "用量台账都记在表格翻译下"


def test_screenshot_is_a_png_data_url_the_executor_accepts() -> None:
    fitz = pytest.importorskip("fitz")
    from retainpdf_translation.llm.shared.model_wire import executor_accepts_images

    from retainpdf_table_agent_engine import table_screenshot
    from retainpdf_table_agent_engine import table_screenshot_part

    document = fitz.open()
    page = document.new_page(width=400, height=300)
    page.insert_text((60, 80), "Sample  Phase  Mass")
    data, media_type = table_screenshot(page, [50, 60, 250, 120])
    pixmap = fitz.Pixmap(data)
    assert media_type == "image/png" and max(pixmap.width, pixmap.height) <= 1000
    assert max(pixmap.width, pixmap.height) >= 700, "小表放大，长边接近 1000 像素（最多放大 4 倍）"
    part = table_screenshot_part(page, [50, 60, 250, 120])
    assert part["image_url"]["url"].startswith("data:image/png;base64,")
    assert executor_accepts_images([{"role": "user", "content": [part, {"type": "text", "text": "表"}]}])
