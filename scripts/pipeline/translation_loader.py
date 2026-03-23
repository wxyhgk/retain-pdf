from __future__ import annotations

from pathlib import Path

from translation.payload import load_translations


def load_translated_pages(translations_dir: Path) -> dict[int, list[dict]]:
    translated_pages: dict[int, list[dict]] = {}
    for path in sorted(translations_dir.glob("page-*-deepseek.json")):
        stem = path.stem
        if not stem.startswith("page-"):
            continue
        page_part = stem.split("-")[1]
        if not page_part.isdigit():
            continue
        page_idx = int(page_part) - 1
        translated_pages[page_idx] = load_translations(path)
    if not translated_pages:
        raise RuntimeError(f"No translation files found in {translations_dir}")
    return translated_pages


def select_translated_pages(
    translated_pages: dict[int, list[dict]],
    *,
    start_page: int,
    end_page: int,
) -> dict[int, list[dict]]:
    start = max(0, start_page)
    stop = max(translated_pages) if end_page < 0 else end_page
    selected_pages = {
        page_idx: items
        for page_idx, items in translated_pages.items()
        if start <= page_idx <= stop
    }
    if not selected_pages:
        raise RuntimeError(f"No translated pages selected in range {start}..{stop}")
    return selected_pages
