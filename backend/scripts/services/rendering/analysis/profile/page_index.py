from __future__ import annotations

import fitz


def page_index(page: fitz.Page) -> int:
    return int(page.number)
