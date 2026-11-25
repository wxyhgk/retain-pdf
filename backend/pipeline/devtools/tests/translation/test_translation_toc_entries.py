"""目录页拆出的条目（structure_role = toc_entry）进翻译、各自成一条（2026-11-25）。"""

from pathlib import Path

import fitz

from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.ocr.document_schema.toc_pages import split_toc_blocks_with_text_layer
from retainpdf_pipeline.render.workflow.source_page_records import extract_text_items as render_extract_text_items
from retainpdf_translation.core.ocr.json_extractor import extract_text_items

ROWS = [("1", "Analyzing the Audience", "1"), ("", "Analyze who your audience is", "3"),
        ("", "References", "13"), ("2", "Balancing Precision", "15")]


def _split_document(*, translate: bool = True):
    text = "\n".join(" ".join(part for part in row if part) for row in ROWS)
    document = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [{
                "width": 420.0, "height": 600.0, "unit": "pt",
                "blocks": [{
                    "type": "text", "sub_type": "table_of_contents", "bbox": [50, 80, 380, 200], "text": text,
                    "lines": [], "segments": [], "tags": ["table_of_contents"],
                    "derived": {"role": "table_of_contents", "by": "", "confidence": 0.0}, "metadata": {},
                }],
            }],
        },
        document_id="toc-doc",
        provider=PROVIDER_GENERIC_FLAT_OCR,
        source_json_path=Path("/tmp/toc-doc.json"),
    )
    # 通用格式默认不翻目录（provider_non_body）；GLM 之类放行目录的服务商给 translate=True。条目照抄目录块的 policy
    document["pages"][0]["blocks"][0]["policy"] = {"translate": translate, "translate_reason": "test"}
    pdf = fitz.open()
    page = pdf.new_page(width=420, height=600)
    y = 100
    for number, title, label in ROWS:
        if number:
            page.insert_text((60, y), number, fontsize=11)
        page.insert_text((90, y), title, fontsize=11)
        page.insert_text((350, y), label, fontsize=11)
        y += 22
    with pdf:
        assert split_toc_blocks_with_text_layer(document, pdf) == 1
    return document


def test_toc_entries_are_translated_one_by_one():
    document = _split_document()
    for extract in (extract_text_items, render_extract_text_items):
        items = extract(document, 0)
        # 每条后面跟它的页码小块（定译就是页码本身，不发请求；排版时在原处重画）
        assert [item.text for item in items] == [
            "1 Analyzing the Audience", "1", "Analyze who your audience is", "3", "References", "13",
            "2 Balancing Precision", "15",
        ]
        assert [item.item_id for item in items] == [f"p001-b{index:03d}" for index in range(8)]
        labels = [item for item in items if item.metadata.get("structure_role") == "toc_page_label" or getattr(item, "structure_role", "") == "toc_page_label"]
        assert [item.metadata["fixed_translation"] for item in labels] == ["1", "3", "13", "15"]
        assert {item.metadata["fixed_translation_source"] for item in labels} == {"toc_page_label"}


def test_page_labels_get_their_fixed_translation_without_a_model_request():
    from retainpdf_translation.core.execution_policy import item_fixed_translation
    from retainpdf_translation_agent_engine.agent_flow import build_agent_pages
    from retainpdf_translation_classic.services.fast_path.keep_origin import _fast_path_keep_origin_result
    from retainpdf_translation_classic.services.fast_path.keep_origin import _is_fast_path_keep_origin_item

    item = {
        "item_id": "p001-b001", "page_idx": 0, "block_type": "text", "block_kind": "text", "block_class": "body",
        "semantic_role": "unknown", "structure_role": "toc_page_label", "policy_translate": True, "should_translate": True,
        "source_text": "13", "protected_source_text": "13", "translation_unit_id": "p001-b001",
        "translation_unit_kind": "single", "translation_unit_member_ids": ["p001-b001"],
        "metadata": {"fixed_translation": "13", "fixed_translation_source": "toc_page_label"},
        "bbox": [350, 90, 362, 102], "normalized_sub_type": "table_of_contents", "protected_map": [], "formula_map": [],
        "final_status": "",
    }
    assert item_fixed_translation(item) == "13"
    # 普通翻译：定译排在「整块只有一个编号」前面，给出译文（保留原文的话排版不擦不画，页码补不回来）
    skip, reason = _is_fast_path_keep_origin_item(item)
    assert skip and reason == "fixed_connective_translation"
    result = _fast_path_keep_origin_result(item, reason)["p001-b001"]
    assert result["decision"] == "translate" and result["translated_text"] == "13"
    assert result["translation_diagnostics"]["route_path"] == ["block_level", "fast_path_fixed_translation"]
    # 翻译 agent：当成定好的译文，不进模型
    pages, _marks = build_agent_pages({0: [item]}, {"pages": [{"page_index": 0, "width": 420, "height": 600}]})
    assert pages[0].blocks[0].fixed_translation == "13"


def test_toc_agent_does_not_take_page_labels_as_entries(tmp_path):
    import json as _json

    from retainpdf_toc_agent import ChatResult
    from retainpdf_pipeline.translate.toc_stage import toc_fixed_translations_fn

    seen = []

    def chat(messages, *, purpose, response_format=None):
        titles = [row["title"] for row in _json.loads(messages[1]["content"])["entries"]]
        seen.extend(titles)
        return ChatResult(_json.dumps({"translations": [{"k": i, "zh": zh} for i, zh in enumerate(["分析受众", "分析读者", "参考文献", "平衡精确"][:len(titles)])]}, ensure_ascii=False))

    fn = toc_fixed_translations_fn(mode="agent", output_dir=tmp_path, api_key="k", model="m", base_url="u", chat_fn=chat)
    fixed = fn(_split_document())
    blocks = {b["block_id"]: b for b in _split_document()["pages"][0]["blocks"]}
    assert seen and not any(title in {"1", "3", "13", "15"} for title in seen)
    assert fixed and all(blocks[block_id]["structure_role"] == "toc_entry" for block_id in fixed)


def test_toc_entries_follow_the_provider_policy():
    document = _split_document(translate=False)
    assert extract_text_items(document, 0) == []


def test_toc_switch_defaults_to_the_toc_agent(tmp_path):
    # translation.toc：agent（默认，2026-11-25 用户定；旧 spec 没有这个键也按 agent）/ translate（目录条目交给普通翻译）
    from retainpdf_pipeline.foundation.shared.stage_specs import _preparation_and_reviewer_fields
    from retainpdf_pipeline.translate.toc_stage import normalize_toc_mode
    from retainpdf_pipeline.translate.toc_stage import toc_fixed_translations_fn

    assert _preparation_and_reviewer_fields({})["toc"] == "agent"
    assert _preparation_and_reviewer_fields({"toc": " Translate "})["toc"] == "translate"
    assert normalize_toc_mode("whatever") == "agent"
    assert toc_fixed_translations_fn(mode="translate", output_dir=tmp_path, api_key="k", model="m", base_url="u") is None
    assert toc_fixed_translations_fn(mode="agent", output_dir=tmp_path, api_key="k", model="m", base_url="u") is not None


def test_toc_agent_mode_gives_the_translation_request_a_fixed_translation_function(tmp_path):
    import json as _json

    from retainpdf_toc_agent import ChatResult
    from retainpdf_pipeline.translate.toc_stage import toc_fixed_translations_fn

    def chat(messages, *, purpose, response_format=None):
        titles = [row["title"] for row in _json.loads(messages[1]["content"])["entries"]]
        return ChatResult(_json.dumps({"translations": [{"k": i, "zh": "分析受众"} for i, _ in enumerate(titles)]}, ensure_ascii=False))

    fn = toc_fixed_translations_fn(mode="agent", output_dir=tmp_path, api_key="k", model="m", base_url="u", chat_fn=chat)
    document = {"pages": [{"blocks": [
        {"block_id": "p001-b0000", "structure_role": "toc_entry", "content": {"text": "1 Analyzing the Audience"},
         "policy": {"translate": True}, "metadata": {"toc_entry_number": "1", "toc_entry_level": 1}},
        {"block_id": "p002-b0000", "structure_role": "heading", "content": {"text": "Analyzing the Audience"},
         "policy": {"translate": True}, "metadata": {}},
    ]}]}
    assert fn(document) == {"p001-b0000": "1 分析受众", "p002-b0000": "分析受众"}
    assert (tmp_path / "toc-agent.v1.json").exists()
