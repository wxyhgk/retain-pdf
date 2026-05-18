from __future__ import annotations

import fitz

from services.rendering.source.cleanup.config import FORMULA_REDACTION_PAD_X
from services.rendering.source.cleanup.config import FORMULA_REDACTION_PAD_Y
from services.rendering.source.cleanup.config import IMAGE_ITEM_REDACTION_PAD_BOTTOM_Y
from services.rendering.source.cleanup.config import IMAGE_ITEM_REDACTION_PAD_TOP_Y
from services.rendering.source.cleanup.config import IMAGE_ITEM_REDACTION_PAD_X
from services.rendering.source.cleanup.config import ITEM_REDACTION_PAD_X
from services.rendering.source.cleanup.config import ITEM_REDACTION_PAD_Y
from services.rendering.source.cleanup.config import WORD_REDACTION_PAD_X
from services.rendering.source.cleanup.config import WORD_REDACTION_PAD_Y


def expand_word_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        rect.x0 - WORD_REDACTION_PAD_X,
        rect.y0 - WORD_REDACTION_PAD_Y,
        rect.x1 + WORD_REDACTION_PAD_X,
        rect.y1 + WORD_REDACTION_PAD_Y,
    )


def expand_formula_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        rect.x0 - FORMULA_REDACTION_PAD_X,
        rect.y0 - FORMULA_REDACTION_PAD_Y,
        rect.x1 + FORMULA_REDACTION_PAD_X,
        rect.y1 + FORMULA_REDACTION_PAD_Y,
    )


def expand_item_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        rect.x0 - ITEM_REDACTION_PAD_X,
        rect.y0 - ITEM_REDACTION_PAD_Y,
        rect.x1 + ITEM_REDACTION_PAD_X,
        rect.y1 + ITEM_REDACTION_PAD_Y,
    )


def expand_image_page_item_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        rect.x0 - IMAGE_ITEM_REDACTION_PAD_X,
        rect.y0 - IMAGE_ITEM_REDACTION_PAD_TOP_Y,
        rect.x1 + IMAGE_ITEM_REDACTION_PAD_X,
        rect.y1 + IMAGE_ITEM_REDACTION_PAD_BOTTOM_Y,
    )
