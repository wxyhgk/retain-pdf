"""定好的译文（2026-11-25，目录 agent）：翻译开头和领域识别同时算，写进块的元数据，两个引擎都不再发请求。不进 checkpoint 指纹（2026-11-26 起，模型产出不进指纹，见 test_checkpoint_identity_model_outputs.py）。"""
from __future__ import annotations

import json
import threading
from pathlib import Path

from retainpdf_translation.core.execution_policy import item_fixed_translation
from retainpdf_translation.core.ocr.json_extractor import extract_text_items
from retainpdf_translation.workflow.checkpoint.identity import build_translation_identity
from retainpdf_translation.workflow.execution import TranslationExecutionRequest
from retainpdf_translation.workflow.execution_plan import build_translation_execution_plan
from retainpdf_translation.workflow.fixed_translations import apply_fixed_translations
from retainpdf_translation_agent_engine.agent_flow import build_agent_pages
from retainpdf_translation_classic.services.fast_path.keep_origin import _fast_path_keep_origin_result
from retainpdf_translation_classic.services.fast_path.keep_origin import _is_fast_path_keep_origin_item


def _block(index: int, text: str, role: str) -> dict:
    bbox = [10, 10 + index * 30, 190, 30 + index * 30]
    return {
        "block_id": f"p001-b{index:04d}", "page_index": 0, "order": index, "type": "text", "sub_type": "",
        "geometry": {"bbox": bbox}, "content": {"kind": "text", "text": text}, "bbox": bbox, "text": text,
        "lines": [], "segments": [], "layout_role": "heading" if role == "heading" else "paragraph",
        "semantic_role": "unknown" if role == "toc_entry" else role, "structure_role": role,
        "policy": {"translate": True, "translate_reason": "test"},
        "provenance": {"provider": "test", "raw_label": "text", "raw_sub_type": "", "raw_bbox": bbox, "raw_path": f"$.b{index}"},
        "continuation_hint": {"source": "", "group_id": "", "role": "", "scope": "", "reading_order": -1, "confidence": 0.0},
        "metadata": {}, "source": {"provider": "test", "raw_type": "text"},
    }


def _document(tmp_path: Path) -> Path:
    path = tmp_path / "document.v1.json"
    path.write_text(json.dumps({
        "schema": "normalized_document_v1", "schema_version": "1.1", "document_id": "fixed-test",
        "source": {"provider": "test", "provider_version": "test", "raw_files": {}}, "page_count": 1,
        "pages": [{"page_index": 0, "width": 200.0, "height": 200.0, "unit": "pt", "blocks": [
            _block(0, "1 Analyzing the Audience", "toc_entry"),
            _block(1, "Analyzing the Audience", "heading"),
            _block(2, "The audience decides everything in a document.", "body"),
        ]}],
        "derived": {}, "markers": {},
    }), encoding="utf-8")
    return path


def _request(tmp_path: Path, fn=None) -> TranslationExecutionRequest:
    return TranslationExecutionRequest(source_json_path=_document(tmp_path), output_dir=tmp_path / "translated",
                                       api_key="sk-test", fixed_translations_fn=fn)


def test_plan_runs_the_function_off_thread_and_marks_blocks(tmp_path: Path) -> None:
    seen = {}

    def fn(document: dict) -> dict[str, str]:
        seen["thread"] = threading.current_thread().name
        seen["blocks"] = len(document["pages"][0]["blocks"])
        return {"p001-b0000": "1 分析受众", "p001-b0001": "分析受众", "missing": "x"}

    plan = build_translation_execution_plan(_request(tmp_path, fn))
    assert seen["thread"].startswith("fixed-translations") and seen["blocks"] == 3
    assert plan.fixed_translations == {"p001-b0000": "1 分析受众", "p001-b0001": "分析受众", "missing": "x"}
    blocks = plan.data["pages"][0]["blocks"]
    assert blocks[0]["metadata"] == {"fixed_translation": "1 分析受众", "fixed_translation_source": "toc_agent"}
    assert "fixed_translation" not in blocks[2]["metadata"]
    items = extract_text_items(plan.data, 0)
    assert [item_fixed_translation(item.__dict__) for item in items] == ["1 分析受众", "分析受众", ""]


def test_fixed_translations_do_not_change_the_fingerprint(tmp_path: Path) -> None:
    plain = _request(tmp_path)
    without = build_translation_identity(plain, build_translation_execution_plan(plain))
    failed = _request(tmp_path, lambda document: (_ for _ in ()).throw(RuntimeError("model down")))
    plan = build_translation_execution_plan(failed)
    # 算定译失败：照常翻，指纹和没有它时一样
    assert plan.fixed_translations is None
    assert build_translation_identity(failed, plan) == without
    fixed = _request(tmp_path, lambda document: {"p001-b0000": "1 分析受众"})
    # 有定译也一样：定译是模型产出，下一次可能失败或者不逐字节一致，进了指纹就会让已译的页整本作废
    with_fixed = build_translation_execution_plan(fixed)
    assert with_fixed.fixed_translations == {"p001-b0000": "1 分析受众"}
    assert build_translation_identity(fixed, with_fixed) == without


def _item(**extra) -> dict:
    return {
        "item_id": "p001-b000", "page_idx": 0, "block_type": "text", "block_kind": "text", "block_class": "body",
        "semantic_role": "unknown", "structure_role": "toc_entry", "policy_translate": True, "should_translate": True,
        "source_text": "1 Analyzing the Audience", "protected_source_text": "1 Analyzing the Audience",
        "translation_unit_id": "p001-b000", "translation_unit_kind": "single", "translation_unit_member_ids": ["p001-b000"],
        "metadata": {"fixed_translation": "1 分析受众", "fixed_translation_source": "toc_agent"},
        "bbox": [10, 10, 190, 30], "normalized_sub_type": "body", "protected_map": [], "formula_map": [], "final_status": "",
        **extra,
    }


def test_classic_engine_uses_the_fixed_translation_without_a_request() -> None:
    item = _item()
    skip, reason = _is_fast_path_keep_origin_item(item)
    assert skip
    result = _fast_path_keep_origin_result(item, reason)["p001-b000"]
    assert result["decision"] == "translate" and result["translated_text"] == "1 分析受众"
    # 续段组成员不给定译，照旧整段翻
    grouped = _item(translation_unit_id="__cg__:cg-1", translation_unit_kind="group", translation_unit_member_ids=["p001-b000", "p002-b000"])
    assert item_fixed_translation(grouped) == ""
    assert _is_fast_path_keep_origin_item(grouped) == (False, "")


def test_agent_engine_takes_the_fixed_translation() -> None:
    pages, _marks = build_agent_pages({0: [_item()]}, {"pages": [{"page_index": 0, "width": 200, "height": 200}]})
    assert pages[0].blocks[0].fixed_translation == "1 分析受众"


def test_apply_skips_unknown_ids_and_counts_blocks() -> None:
    data = {"pages": [{"blocks": [{"block_id": "a", "metadata": None}, {"block_id": "b"}]}]}
    assert apply_fixed_translations(data, {"a": "甲", "z": "无"}) == 1
    assert data["pages"][0]["blocks"][0]["metadata"]["fixed_translation"] == "甲"
    assert apply_fixed_translations(data, {}) == 0
