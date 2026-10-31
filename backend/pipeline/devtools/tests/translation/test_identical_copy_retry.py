"""模型把有英文的原文原样交回时带提示重翻一次（2026-10-31 量子化学-14 p014-b022 "which has the same form as Eq. (8.94)."）。"""

from __future__ import annotations

from retainpdf_translation.llm.result_payload import result_entry
from retainpdf_translation.llm.shared.control_context import build_translation_control_context
from retainpdf_translation.llm.shared.orchestration import direct_typst
from retainpdf_translation.llm.shared.orchestration.identical_copy import RETRY_HINT
from retainpdf_translation.llm.shared.orchestration.identical_copy import worth_retrying_identical_copy


def _item(text: str, **extra) -> dict:
    return {
        "item_id": "p014-b022",
        "block_type": "text",
        "math_mode": "direct_typst",
        "metadata": {"structure_role": "body"},
        "protected_source_text": text,
        "translation_unit_protected_source_text": text,
        **extra,
    }


KEPT = lambda item_id: {item_id: result_entry("keep_origin", "")}  # noqa: E731


def _run(item: dict, answers: list) -> tuple[dict, list[dict]]:
    sent: list[dict] = []

    def fake_plain(request_item, **_kwargs):
        sent.append(request_item)
        answer = answers.pop(0)
        return answer(request_item["item_id"]) if callable(answer) else {request_item["item_id"]: result_entry("translate", answer)}

    result = direct_typst.translate_direct_typst_plain_text_with_retries(
        item,
        api_key="",
        model="m",
        base_url="https://example.test/v1",
        request_label="",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        translator=None,
        translate_plain_fn=fake_plain,
    )
    return result, sent


def test_an_unchanged_short_sentence_is_retried_once_with_a_hint() -> None:
    result, sent = _run(_item("which has the same form as Eq. (8.94)."), [KEPT, "其形式与式 (8.94) 相同。"])
    assert result["p014-b022"]["translated_text"] == "其形式与式 (8.94) 相同。"
    assert len(sent) == 2
    assert "translation_style_hint" not in sent[0]
    assert RETRY_HINT.format(target="简体中文") in sent[1]["translation_style_hint"]
    assert "identical_copy_retry" in result["p014-b022"]["translation_diagnostics"]["route_path"]


def test_unchanged_again_is_kept_as_origin() -> None:
    result, sent = _run(_item("Gaussian Program Package"), [KEPT, KEPT])
    assert result["p014-b022"]["decision"] == "keep_origin" and len(sent) == 2


def test_things_that_are_not_english_words_are_not_retried() -> None:
    for text in ("DFT", "B3LYP/6-31G*", "https://example.org/data", "$ \\mu_x $", "(8.94)"):
        assert not worth_retrying_identical_copy(_item(text), KEPT("p014-b022")), text
    for text in ("EXAMPLE", "We have", "First angle", "Matrix Form of the Roothaan Equations"):
        assert worth_retrying_identical_copy(_item(text), KEPT("p014-b022")), text
    # 真翻了的不重翻
    assert not worth_retrying_identical_copy(_item("We have"), {"p014-b022": result_entry("translate", "我们有")})


def test_a_batch_hands_unchanged_items_to_the_single_path_and_does_not_cache_them(monkeypatch) -> None:
    from retainpdf_translation.llm.shared.orchestration import batched_plain

    monkeypatch.setattr(batched_plain, "should_use_direct_deepseek_batch", lambda *a, **k: True)
    stored: list[list[str]] = []
    monkeypatch.setattr(batched_plain, "store_cacheable_batch_result", lambda batch, result, **k: stored.append([i["item_id"] for i in batch]))
    a = {**_item("We have"), "item_id": "a"}
    b = {**_item("The energy is minimized along the path."), "item_id": "b"}

    def fake_batch(batch, **_kwargs):
        return {"a": result_entry("keep_origin", ""), "b": result_entry("translate", "能量沿路径最小化。")}

    result, retry, complete, attempted = batched_plain._try_direct_batched_plain(
        [a, b],
        api_key="",
        model="m",
        base_url="https://example.test/v1",
        request_label="",
        context=build_translation_control_context(mode="sci"),
        diagnostics=None,
        store_cached_batch_fn=None,
        translate_batch_once_fn=fake_batch,
    )
    assert set(result) == {"b"} and [i["item_id"] for i in retry] == ["a"]
    assert complete is False and attempted is True
    assert stored == [["b"]]


def test_an_echoed_source_before_the_translation_is_dropped() -> None:
    from retainpdf_translation.llm.result_canonicalizer import canonicalize_batch_result

    item = _item("which has the same form as Eq. (8.94).")
    raw = {"p014-b022": result_entry("translate", "which has the same form as Eq. (8.94).其具有与式 (8.94) 相同的形式。")}
    assert canonicalize_batch_result([item], raw)["p014-b022"]["translated_text"] == "其具有与式 (8.94) 相同的形式。"
    # 只抄了原文、没有中文的不动（交给原样交回那条路）
    same = {"p014-b022": result_entry("translate", "which has the same form as Eq. (8.94).")}
    assert canonicalize_batch_result([item], same)["p014-b022"]["decision"] == "keep_origin"


def test_a_leading_english_where_becomes_qizhong() -> None:
    from retainpdf_translation.llm.result_canonicalizer import translate_leading_where

    assert translate_leading_where("where $\\hat{T}_{el}$ 和 $\\hat{V}$ 分别是动能和势能算符") == "其中 $\\hat{T}_{el}$ 和 $\\hat{V}$ 分别是动能和势能算符"
    assert translate_leading_where("Where 电子的位置矢量为") == "其中电子的位置矢量为"
    assert translate_leading_where("where the energy is minimal") == "where the energy is minimal"
    assert translate_leading_where("其中 where 不在开头") == "其中 where 不在开头"


def test_a_burst_of_connection_resets_cuts_once_and_climbs_back_quickly() -> None:
    from retainpdf_translation.artifacts import TranslationRunDiagnostics

    run = TranslationRunDiagnostics(provider_family="other", model="m", base_url="https://example.test/v1",
                                    configured_workers=50, configured_batch_size=8, configured_classify_batch_size=12)
    run.configure_adaptive_concurrency(initial_limit=32, floor_limit=8)
    epochs = [run.acquire_request_slot() for _ in range(32)]
    for epoch in epochs[:2]:
        run.release_request_slot(success=False, elapsed_ms=16000, error_class="ConnectionError", slot_epoch=epoch)
    summary = run.build_summary()["adaptive_concurrency"]
    assert summary["current_limit"] == 16 and summary["cut_count"] == 1 and summary["ceiling_limit"] == 32
    for epoch in epochs[2:]:
        run.release_request_slot(success=True, elapsed_ms=3000, status_code=200, slot_epoch=epoch)
    assert run.build_summary()["adaptive_concurrency"]["current_limit"] == 31, "two successes per step back towards 32"
