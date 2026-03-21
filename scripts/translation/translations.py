import json
from pathlib import Path

from ocr.models import TextItem
from translation.formula_protection import re_protect_restored_formulas
from translation.formula_protection import protect_inline_formulas_in_segments


def export_translation_template(items: list[TextItem], output_path: Path, page_idx: int) -> None:
    payload = []
    for item in items:
        protected_source_text, formula_map = protect_inline_formulas_in_segments(item.segments)
        payload.append(
            {
                "item_id": item.item_id,
                "page_idx": item.page_idx,
                "block_idx": item.block_idx,
                "block_type": item.block_type,
                "bbox": item.bbox,
                "source_text": item.text,
                "lines": item.lines,
                "metadata": item.metadata,
                "protected_source_text": protected_source_text,
                "formula_map": formula_map,
                "classification_label": "",
                "should_translate": True,
                "protected_translated_text": "",
                "translated_text": "",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "group_protected_source_text": "",
                "group_formula_map": [],
                "group_protected_translated_text": "",
                "group_translated_text": "",
            }
        )

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def load_translations(translation_path: Path) -> list[dict]:
    with translation_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_translations(translation_path: Path, payload: list[dict]) -> None:
    with translation_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def ensure_translation_template(items: list[TextItem], output_path: Path, page_idx: int) -> Path:
    if not output_path.exists():
        output_path.parent.mkdir(parents=True, exist_ok=True)
        export_translation_template(items, output_path, page_idx=page_idx)
        return output_path

    payload = load_translations(output_path)
    item_map = {item.item_id: item for item in items}
    changed = False
    for record in payload:
        item = item_map.get(record.get("item_id"))
        if not item:
            continue
        if (
            "protected_source_text" not in record
            or "formula_map" not in record
            or "protected_translated_text" not in record
            or "lines" not in record
        ):
            protected_source_text, formula_map = protect_inline_formulas_in_segments(item.segments)
            record["source_text"] = item.text
            record["lines"] = item.lines
            record["metadata"] = item.metadata
            record["protected_source_text"] = protected_source_text
            record["formula_map"] = formula_map
            record.setdefault("classification_label", "")
            record.setdefault("should_translate", True)
            record.setdefault("protected_translated_text", "")
            record.setdefault("continuation_group", "")
            record.setdefault("continuation_prev_text", "")
            record.setdefault("continuation_next_text", "")
            record.setdefault("group_protected_source_text", "")
            record.setdefault("group_formula_map", [])
            record.setdefault("group_protected_translated_text", "")
            record.setdefault("group_translated_text", "")
            changed = True
        if "classification_label" not in record:
            record["classification_label"] = ""
            changed = True
        if "metadata" not in record:
            record["metadata"] = item.metadata
            changed = True
        if "should_translate" not in record:
            record["should_translate"] = True
            changed = True
        if "continuation_group" not in record:
            record["continuation_group"] = ""
            changed = True
        if "continuation_prev_text" not in record:
            record["continuation_prev_text"] = ""
            changed = True
        if "continuation_next_text" not in record:
            record["continuation_next_text"] = ""
            changed = True
        if "group_protected_source_text" not in record:
            record["group_protected_source_text"] = ""
            changed = True
        if "group_formula_map" not in record:
            record["group_formula_map"] = []
            changed = True
        if "group_protected_translated_text" not in record:
            record["group_protected_translated_text"] = ""
            changed = True
        if "group_translated_text" not in record:
            record["group_translated_text"] = ""
            changed = True
        if not record.get("protected_translated_text") and record.get("translated_text"):
            record["protected_translated_text"] = re_protect_restored_formulas(
                record["translated_text"],
                record.get("formula_map", []),
            )
            changed = True
    if changed:
        save_translations(output_path, payload)
    return output_path
