from __future__ import annotations

import fitz


def drawing_count(page: fitz.Page) -> int:
    try:
        drawings = page.get_cdrawings() if hasattr(page, "get_cdrawings") else page.get_drawings()
    except Exception:
        return 0
    return len(drawings)
