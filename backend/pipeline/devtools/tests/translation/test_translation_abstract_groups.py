import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.layout.payload.prepare import prepare_render_payloads_by_page
from retainpdf_pipeline.translate.core.orchestration.units import finalize_payload_orchestration_metadata
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_translated_text_map
from retainpdf_pipeline.translate.core.payload.parts.units import pending_translation_items
from retainpdf_pipeline.translate.services.finalization import recover_blocking_untranslated_items
from retainpdf_pipeline.translate.services.postprocess import garbled_reconstruction


def _abstract(item_id: str, bbox: list[float], source: str) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_idx": int(item_id.rsplit("b", 1)[-1]),
        "block_type": "text",
        "block_kind": "text",
        "block_class": "title",
        "layout_role": "paragraph",
        "semantic_role": "abstract",
        "structure_role": "body",
        "bbox": bbox,
        "source_text": source,
        "protected_source_text": source,
        "formula_map": [],
        "protected_map": [],
        "should_translate": True,
        "math_mode": "direct_typst",
    }


def _two_slot_abstract() -> list[dict]:
    return [
        _abstract(
            "p001-b015",
            [47.993, 270.467, 310.453, 415.449],
            "The abstract starts in the narrow box beside the figure and establishes the problem.",
        ),
        _abstract(
            "p001-b019",
            [48.493, 414.949, 557.416, 525.935],
            (
                "The abstract continues in the full-width box below the figure, reports the comparison, "
                "explains the mechanism, and closes with the main scientific conclusion."
            ),
        ),
    ]


def test_abstract_slots_form_one_aggregate_translation_unit_without_merging_bboxes() -> None:
    payload = _two_slot_abstract()
    original_bboxes = [list(item["bbox"]) for item in payload]

    finalize_payload_orchestration_metadata(payload)
    pending = pending_translation_items(payload)

    assert len(pending) == 1
    unit = pending[0]
    assert unit["item_id"] == "__cg__:abstract:p001-b015"
    assert unit["translation_group_kind"] == "abstract"
    assert unit["translation_group_strategy"] == "aggregate_geometry"
    assert unit["translation_unit_member_ids"] == ["p001-b015", "p001-b019"]
    assert unit["translation_unit_members"] == [
        {"item_id": item["item_id"], "protected_source_text": item["protected_source_text"]}
        for item in payload
    ]
    assert payload[0]["translation_unit_id"] == unit["item_id"]
    assert payload[1]["translation_unit_id"] == unit["item_id"]
    assert [item["bbox"] for item in payload] == original_bboxes
    assert payload[0]["protected_source_text"] in unit["protected_source_text"]
    assert payload[1]["protected_source_text"] in unit["protected_source_text"]


def test_completed_legacy_abstract_slots_remain_independent() -> None:
    payload = _two_slot_abstract()
    payload[0]["translated_text"] = "已有的第一段摘要译文。"
    payload[0]["protected_translated_text"] = "已有的第一段摘要译文。"
    payload[1]["translated_text"] = "已有的第二段摘要译文。"
    payload[1]["protected_translated_text"] = "已有的第二段摘要译文。"

    finalize_payload_orchestration_metadata(payload)

    assert [item["translation_unit_kind"] for item in payload] == ["single", "single"]
    assert [item["translation_unit_id"] for item in payload] == ["p001-b015", "p001-b019"]
    assert [item["translated_text"] for item in payload] == ["已有的第一段摘要译文。", "已有的第二段摘要译文。"]


def test_aggregate_abstract_translation_is_split_across_original_render_boxes() -> None:
    payload = _two_slot_abstract()
    original_bboxes = [list(item["bbox"]) for item in payload]
    finalize_payload_orchestration_metadata(payload)
    unit = pending_translation_items(payload)[0]
    aggregate_translation = (
        "摘要首先说明研究问题和应用背景，并介绍图旁窄栏中的核心定义。"
        "随后在图下方的全宽区域报告系统比较结果，解释所观察现象的物理机制，"
        "最后给出适用范围、主要结论以及使用该方法时需要注意的限制。"
    )

    apply_translated_text_map(
        payload,
        {
            unit["item_id"]: {
                "decision": "translate",
                "translated_text": aggregate_translation,
            }
        },
    )
    prepared = prepare_render_payloads_by_page({0: payload})[0]

    chunks = [str(item.get("render_protected_text", "") or "") for item in prepared]
    assert all(chunks)
    assert chunks[0] != aggregate_translation
    assert chunks[1] != aggregate_translation
    assert len(chunks[1]) > len(chunks[0])
    assert all(item["translation_unit_protected_translated_text"] == aggregate_translation for item in payload)
    assert [item["bbox"] for item in prepared] == original_bboxes


def test_final_recovery_retries_aggregate_abstract_once_without_destroying_group() -> None:
    payload = _two_slot_abstract()
    original_bboxes = [list(item["bbox"]) for item in payload]
    finalize_payload_orchestration_metadata(payload)
    for item in payload:
        item["final_status"] = "failed"
        item["translation_diagnostics"] = {"final_status": "failed"}
    calls: list[str] = []
    recovered_translation = (
        "摘要首先介绍研究问题与应用背景，并说明图旁窄栏中的核心概念。"
        "随后在图下方区域报告系统比较结果，解释观察到的物理机制，"
        "最后总结主要科学结论、方法的适用范围以及实际使用时需要注意的限制。"
    )

    def _fake_request(messages, **_kwargs):
        calls.append(str(messages[-1]["content"]))
        return recovered_translation

    summary = recover_blocking_untranslated_items(
        {0: payload},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_chat_content_fn=_fake_request,
    )

    assert summary.recovered_items == 1
    assert summary.blocking_after == 0
    assert len(calls) == 1
    assert payload[0]["source_text"] in calls[0]
    assert payload[1]["source_text"] in calls[0]
    assert payload[0]["translation_unit_member_ids"] == ["p001-b015", "p001-b019"]
    assert payload[1]["translation_unit_member_ids"] == ["p001-b015", "p001-b019"]
    assert all(item["translated_text"] for item in payload)
    assert [item["bbox"] for item in payload] == original_bboxes


def test_garbled_reconstruction_repairs_aggregate_abstract_once() -> None:
    payload = _two_slot_abstract()
    finalize_payload_orchestration_metadata(payload)
    for item in payload:
        item["final_status"] = "failed"
        item["translation_diagnostics"] = {"final_status": "failed"}
    calls = 0
    reconstructed_translation = (
        "摘要首先重建研究问题与应用背景，并说明图旁窄栏中的核心概念。"
        "随后在图下方区域报告计算方法和系统比较结果，解释观察到的作用机制，"
        "最后总结主要科学结论、适用范围以及使用该方法时需要注意的限制。"
    )

    def _fake_request(_messages, **_kwargs):
        nonlocal calls
        calls += 1
        return '{"translated_text":"' + reconstructed_translation + '"}'

    runtime = garbled_reconstruction.GarbledReconstructionRuntime(
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        provider_reason="test",
        request_chat_content_fn=_fake_request,
    )
    summary = garbled_reconstruction.reconstruct_garbled_page_payloads(
        {0: payload},
        api_key="ignored",
        model="ignored",
        base_url="ignored",
        workers=2,
        runtime=runtime,
    )

    assert summary["garbled_candidates"] == 1
    assert summary["garbled_reconstructed"] == 1
    assert summary["dirty_pages"] == [0]
    assert calls == 1
    assert all(item["final_status"] == "translated" for item in payload)
    assert all(item["translation_diagnostics"]["garbled_reconstructed"] is True for item in payload)
    assert all(item["translated_text"] for item in payload)
