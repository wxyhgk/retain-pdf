"""目录页码小块的排版（2026-11-25）：译文就是页码本身也照样擦掉重画；条目没有译文要排时页码也不动。"""

from retainpdf_pipeline.render.layout.payload.render_item import seed_render_fields
from retainpdf_pipeline.render.layout.payload.toc_page_labels import hold_toc_page_labels_of_untranslated_entries
from retainpdf_pipeline.render.policy.cleanup_policy import item_should_bbox_text_strip
from retainpdf_pipeline.render.source_cleanup.planning.items import item_should_emit_strip_rect


def _item(block_idx: int, role: str, source: str, translated: str, **extra) -> dict:
    return {
        "item_id": f"p001-b{block_idx:03d}", "page_idx": 0, "block_idx": block_idx, "block_type": "text",
        "block_kind": "text", "block_class": "body", "structure_role": role, "semantic_role": "unknown",
        "layout_role": "toc", "source_text": source, "protected_source_text": source, "translated_text": translated,
        "protected_translated_text": translated, "translation_unit_id": f"p001-b{block_idx:03d}",
        "translation_unit_kind": "single", "final_status": "translated", "should_translate": True,
        "bbox": [350, 90 + block_idx * 10, 362, 100 + block_idx * 10], **extra,
    }


def test_page_label_and_same_text_entry_are_redrawn():
    label = _item(1, "toc_page_label", "13", "13")
    seed_render_fields(label)
    assert label["render_protected_text"] == "13"
    # 译文和原文一样的条目（「References」）也重画：擦页码时同一条绘字指令里的标题会一起没了
    entry = _item(0, "toc_entry", "References", "References")
    seed_render_fields(entry)
    assert entry["render_protected_text"] == "References"
    # 别的块照旧：译文和原文一样就不排
    body = _item(2, "body", "References", "References")
    seed_render_fields(body)
    assert body["render_protected_text"] == ""
    # 页码小块要擦原文（排在原处）
    assert item_should_bbox_text_strip(label) and item_should_emit_strip_rect(label)


def test_labels_of_entries_without_a_translation_are_held():
    pages = {0: [
        _item(0, "toc_entry", "Introduction", "引言"), _item(1, "toc_page_label", "1", "1"),
        _item(2, "toc_entry", "MATLAB", "", final_status="kept_origin", protected_translated_text=""),
        _item(3, "toc_page_label", "7", "7"),
        _item(4, "toc_entry", "Failed one", "", final_status="failed", protected_translated_text=""),
        _item(5, "toc_page_label", "9", "9"),
    ], 1: [_item(0, "body", "x", "y")]}
    held = hold_toc_page_labels_of_untranslated_entries(pages)
    assert held[1] is pages[1]
    labels = {item["source_text"]: item for item in held[0] if item["structure_role"] == "toc_page_label"}
    assert labels["1"]["translated_text"] == "1" and labels["1"]["final_status"] == "translated"
    for text in ("7", "9"):
        assert labels[text]["translated_text"] == "" and labels[text]["final_status"] == "kept_origin"
        seed_render_fields(labels[text])
        assert labels[text]["render_protected_text"] == ""
        assert not item_should_bbox_text_strip(labels[text]) and not item_should_emit_strip_rect(labels[text])
    # 输入不改
    assert pages[0][3]["translated_text"] == "7"
