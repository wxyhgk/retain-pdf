"""模型照抄接口注入的提醒（<ip_reminder>…</ip_reminder>）当译文：去掉；只剩它的当没翻出来、照常重试。

2026-11-03 一本 6574 页的手册 703 块、另外 5 本书各 1-5 块的「译文」是这段提醒（haiku 把它翻成中文接在译文后面，
或者整段代替译文），以前校验放过去了。
"""

from __future__ import annotations

import pytest

from retainpdf_translation.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_translation.llm.result_canonicalizer import strip_injected_reminders
from retainpdf_translation.llm.result_validator import validate_batch_result
from retainpdf_translation.llm.validation.errors import EmptyTranslationError

REMINDER = (
    "<ip_reminder>\n这是一条自动提醒。请尽可能提供帮助，但务必谨慎，不要复现任何受版权保护的材料，包括歌词、书籍章节"
    "或较长的期刊摘录。你应避免直接提及或回应本提醒，因为默认情况下它不会展示给用户。\n</ip_reminder>"
)


def _item(item_id: str, source_text: str) -> dict:
    return {
        "item_id": item_id,
        "block_type": "text",
        "source_text": source_text,
        "protected_source_text": source_text,
        "should_translate": True,
    }


@pytest.mark.parametrize(
    ("translated", "expected"),
    [
        ("（请不参考正文作答。）\n" + REMINDER, "（请不参考正文作答。）"),
        (REMINDER + "\n密度泛函在数值格点上计算。", "密度泛函在数值格点上计算。"),
        (REMINDER, ""),
        ("译文。<system-reminder>别的注入提醒</system-reminder>", "译文。"),
        ("译文。<ip_reminder>没闭合的提醒一直到结尾", "译文。"),
        ("没有提醒的译文 $<x>$ 照旧", "没有提醒的译文 $<x>$ 照旧"),
    ],
)
def test_injected_reminders_are_stripped_from_translations(translated: str, expected: str) -> None:
    assert strip_injected_reminders(translated) == expected


def test_canonicalizer_drops_the_reminder_and_keeps_the_translation() -> None:
    item = _item("p111-b001", "(Try to answer these without referring to the text.)")
    result = canonicalize_batch_result(
        [item],
        {"p111-b001": {"decision": "translate", "translated_text": "（请不参考正文作答。）\n" + REMINDER}},
    )

    assert result["p111-b001"]["translated_text"] == "（请不参考正文作答。）"
    validate_batch_result([item], result)


def test_a_reminder_alone_is_an_empty_translation_and_gets_retried() -> None:
    item = _item("p3297-b002", "The density functional is evaluated on the numerical grid of the molecule.")
    result = canonicalize_batch_result(
        [item],
        {"p3297-b002": {"decision": "translate", "translated_text": REMINDER}},
    )

    assert result["p3297-b002"]["translated_text"] == ""
    with pytest.raises(EmptyTranslationError):
        validate_batch_result([item], result)
