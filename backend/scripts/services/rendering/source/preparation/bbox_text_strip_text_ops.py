from __future__ import annotations

import fitz
import pikepdf

from services.rendering.source.preparation.bbox_text_strip_pdf_math import PdfMatrix
from services.rendering.source.preparation.bbox_text_strip_pdf_math import matrix_point


TEXT_SHOW_OPERATORS = {"Tj", "TJ", "'", '"'}
DEFAULT_TEXT_ADVANCE_PT = 18.0
MIN_TEXT_BOX_HEIGHT_PT = 2.0
TEXT_DEFAULT_RENDER_MODE = 0


def text_operand_length(operands: object) -> int:
    if not operands:
        return 0
    value = operands[-1] if len(operands) > 1 else operands[0]
    if isinstance(value, (str, bytes, pikepdf.String)):
        return len(str(value))
    if isinstance(value, pikepdf.Array):
        return sum(len(str(item)) for item in value if isinstance(item, (str, bytes, pikepdf.String)))
    return 1


def text_advance_tx(text_matrix: PdfMatrix, operands: object) -> float:
    text_length = text_operand_length(operands)
    font_size = max(abs(text_matrix[0]), 1.0)
    tx = min(DEFAULT_TEXT_ADVANCE_PT, max(1.0, text_length * font_size * 0.5))
    return tx / font_size


def estimated_text_rect(
    matrix: PdfMatrix,
    *,
    text_length: int,
) -> fitz.Rect:
    x, y = matrix_point(matrix)
    font_height = max(abs(matrix[3]), abs(matrix[1]), MIN_TEXT_BOX_HEIGHT_PT)
    char_width = max(abs(matrix[0]) * 0.5, 1.0)
    width = max(char_width, min(DEFAULT_TEXT_ADVANCE_PT, char_width * max(text_length, 1)))
    return fitz.Rect(x, y - font_height * 0.35, x + width, y + font_height * 1.05)
