"""合法 JSON 里的弯引号、全角冒号不能被「宽松修复」改坏。

真实事故（2026-10）：风格指南 8 本书全部解析失败退回模板，术语预扫丢批，组成员解析失败重发——
回复本来是合法 JSON，只因为字符串里有「Vue’s」「“效应”」「注：」，被一律替换成英文引号 / 冒号改坏了。
"""
import json

import pytest

from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_json_text
from retainpdf_pipeline.translate.llm.shared.structured_output import parse_structured_json
from retainpdf_pipeline.translate.services.preparation.term_prescan import parse_prescan_response


@pytest.mark.parametrize("content", [
    '{"terms": [{"source": "Vue’s reactivity system", "target": "Vue 的响应式系统", "kind": "domain_term"}]}',
    '{"rules": ["引用他人观点时用“”，不用「」", "术语首次出现括注原文"]}',
    '{"translated_text": "注：此处的“效应”指 effect。"}',
    '```json\n{"note": "It’s a ‘quoted’ word"}\n```',
    '模型的说明文字……\n{"rules": ["专有名词保留原文：如 “Granule”"]}',
    '{"text": "$\\beta$ 是 Vue’s 参数"}',
])
def test_valid_json_with_curly_quotes_is_kept_verbatim(content):
    expected = content.strip().removeprefix("```json").removesuffix("```").strip()
    expected = expected[expected.index("{"):]
    assert extract_json_text(content) == expected
    assert parse_structured_json(content) == json.loads(expected.replace("\\beta", "\\\\beta"))


def test_json_written_with_curly_quotes_is_still_repaired():
    content = '{“translations”: [{“item_id”: “p1-b1”, “translated_text”: “你好”}]}'
    assert json.loads(extract_json_text(content)) == {
        "translations": [{"item_id": "p1-b1", "translated_text": "你好"}]
    }


def test_missing_outer_braces_are_still_added():
    content = '"translations": [{"item_id": "p1-b1", "translated_text": "注：好"}]'
    payload = json.loads(extract_json_text(content))
    assert list(payload) == ["translations"]


def test_the_term_prescan_reply_that_used_to_fail_now_parses():
    content = (
        '{"terms": [{"source": "Functional reactive programming", "target": "函数响应式编程", "kind": "domain_term"}, '
        '{"source": "Vue’s reactivity system", "target": "Vue的响应式系统", "kind": "domain_term"}, '
        '{"source": "glitch freedom", "target": "无毛刺性", "kind": "domain_term"}]}'
    )
    assert [term["source"] for term in parse_prescan_response(content)] == [
        "Functional reactive programming", "Vue’s reactivity system", "glitch freedom",
    ]
