from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def single_pdf(path: Path) -> Path:
    pdfs = sorted(path.glob("*.pdf"))
    if len(pdfs) != 1:
        raise RuntimeError(f"expected exactly one PDF in {path}, found {len(pdfs)}")
    return pdfs[0].resolve()


def translated_pages(job_root: Path) -> dict[int, list[dict]]:
    manifest = load_json(job_root / "translated" / "translation-manifest.json")
    pages: dict[int, list[dict]] = {}
    for page in manifest.get("pages", []):
        rel = str(page.get("path", "") or "").strip()
        if not rel:
            continue
        page_idx = int(page.get("page_index", len(pages)) or 0)
        pages[page_idx] = load_json(job_root / "translated" / rel)
    return pages
