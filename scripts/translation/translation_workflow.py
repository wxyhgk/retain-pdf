from pathlib import Path

from translation.deepseek_client import translate_batch
from translation.formula_protection import restore_inline_formulas
from translation.translations import ensure_translation_template, load_translations, save_translations


def chunked(seq: list[dict], size: int) -> list[list[dict]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def default_page_translation_name(page_idx: int) -> str:
    return f"page-{page_idx + 1:03d}-deepseek.json"


def translate_items_to_path(
    items: list,
    translation_path: Path,
    page_idx: int,
    api_key: str,
    batch_size: int = 8,
    model: str = "deepseek-chat",
    progress_label: str = "",
) -> dict:
    ensure_translation_template(items, translation_path, page_idx=page_idx)

    payload = load_translations(translation_path)
    pending = [item for item in payload if not (item.get("translated_text") or "").strip()]
    batches = chunked(pending, max(1, batch_size))
    total_batches = len(batches)

    label = progress_label or f"page {page_idx + 1}"
    for index, batch in enumerate(batches, start=1):
        translated = translate_batch(batch, api_key=api_key, model=model)
        for item in payload:
            item_id = item.get("item_id")
            if item_id not in translated:
                continue
            protected_translated_text = translated[item_id]
            item["protected_translated_text"] = protected_translated_text
            item["translated_text"] = restore_inline_formulas(
                protected_translated_text,
                item.get("formula_map", []),
            )
        save_translations(translation_path, payload)
        print(f"{label}: translated batch {index}/{total_batches}")

    translated_count = sum(1 for item in payload if (item.get("translated_text") or "").strip())
    return {
        "translation_path": str(translation_path),
        "page_idx": page_idx,
        "total_items": len(payload),
        "translated_items": translated_count,
        "pending_items": len(payload) - translated_count,
    }
