"""极短的独立块（编号 / 标签 / 单个连接词）默认不发模型请求。

实测（data/jobs/20261006023250-703433，一本物理教材）：单独成块的 "(7)"、"(a)"、"and"、
"where"、"SOLUTION:" 每个都单发一次约 1000 token 的请求；模型还把 p003-b009 / p004-b022 /
p021-b010 / p043-b013 的 "and"、p022-b006 的 "SO" 判成保留原文，留下英文——同一个 "and"
在续段组 p007-b013 里却译成了「和」。
"""

import pytest

from retainpdf_translation.core.execution_policy import is_standalone_number
from retainpdf_translation.core.payload.parts.apply import apply_single_translated_entry
from retainpdf_translation_classic.services.fast_path.keep_origin import _fast_path_keep_origin_result
from retainpdf_translation_classic.services.fast_path.keep_origin import _is_fast_path_keep_origin_item


@pytest.fixture(autouse=True)
def default_transport(monkeypatch):
    # 默认配置：不开 rust transport，也不开 page_local_v1。
    monkeypatch.delenv("RETAIN_TRANSLATION_TRANSPORT", raising=False)
    monkeypatch.delenv("RETAIN_TRANSLATION_OPTIMIZATION", raising=False)


def _item(text: str, **extra) -> dict:
    return {
        "item_id": "p003-b009",
        "page_idx": 2,
        "block_type": "text",
        "block_kind": "text",
        "block_class": "body",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "should_translate": True,
        "source_text": text,
        "protected_source_text": text,
        "translation_unit_id": "p003-b009",
        "translation_unit_kind": "single",
        "translation_unit_member_ids": ["p003-b009"],
        "translation_unit_protected_source_text": text,
        **extra,
    }


def _fast_path(item: dict) -> dict:
    should_skip, reason = _is_fast_path_keep_origin_item(item)
    assert should_skip, item["source_text"]
    return _fast_path_keep_origin_result(item, reason)[item["item_id"]]


@pytest.mark.parametrize("text", ["(7)", "(3)", "[12]", "1.", "(a)", "(B)", "(ii)", "(5.6)", "(3a)"])
def test_standalone_numbers_and_labels_keep_origin_by_default(text):
    assert is_standalone_number({"source_text": text})
    result = _fast_path(_item(text))
    assert result["decision"] == "keep_origin"
    assert result["translation_diagnostics"]["degradation_reason"] == "skip_standalone_number"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("and", "和"),
        ("And", "和"),
        ("AND", "和"),
        ("or", "或"),
        ("where", "其中"),
        ("Where,", "其中，"),
        ("where:", "其中："),
        ("so", "所以"),
        ("SO", "所以"),
        ("then", "则"),
        ("SOLUTION:", "解："),
        ("Solution", "解"),
        ("SOLUTION :", "解："),
    ],
)
def test_standalone_connective_gets_fixed_translation_without_model(text, expected):
    item = _item(text)
    result = _fast_path(item)
    assert result["decision"] == "translate"
    assert result["translated_text"] == expected
    assert result["translation_diagnostics"]["route_path"] == ["block_level", "fast_path_fixed_translation"]

    apply_single_translated_entry(item, result)
    assert item["translated_text"] == expected
    assert item["final_status"] == "translated"


@pytest.mark.parametrize(
    "item",
    [
        _item("and so"),
        _item("and the"),
        _item("are"),
        _item("Andrew"),
        _item("Introduction"),
        _item("and", continuation_group="cg-1"),
        _item("and", translation_unit_id="__cg__:cg-1"),
        _item("and", translation_unit_member_ids=["a", "b"]),
        _item("and", protected_map=[{"token": "x"}]),
        _item("(7)", continuation_group="cg-1"),
    ],
)
def test_fast_path_only_applies_to_isolated_whole_block(item):
    should_skip, _reason = _is_fast_path_keep_origin_item(item)
    assert not should_skip


def test_builder_routes_tiny_blocks_without_requests_by_default(monkeypatch):
    from types import SimpleNamespace

    from retainpdf_translation_classic.workflow.batching import batching

    monkeypatch.setattr(batching, "_is_low_risk_batchable_item", lambda *args, **kwargs: False)
    items = [_item("(7)", item_id="n"), _item("and", item_id="c"), _item("Introduction", item_id="body")]
    batches, immediate = batching._build_translation_batches(
        items,
        effective_batch_size=1,
        translation_context=None,
        is_fast_path_keep_origin_item_fn=_is_fast_path_keep_origin_item,
        fast_path_keep_origin_result_fn=_fast_path_keep_origin_result,
        plan_item_view_fn=lambda item: SimpleNamespace(source=item["source_text"]),
    )
    assert [i["item_id"] for b in batches for i in b] == ["body"]
    merged = {key: value for entry in immediate for key, value in entry.items()}
    assert merged["n"]["decision"] == "keep_origin"
    assert merged["c"]["decision"] == "translate"
    assert merged["c"]["translated_text"] == "和"
