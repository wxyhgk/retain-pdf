from __future__ import annotations

import fitz


def page_rotation(page: fitz.Page) -> int:
    return int(page.rotation or 0)
