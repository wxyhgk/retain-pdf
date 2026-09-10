from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import RectIndex
from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import RectTuple
from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import is_protected_text_op
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import PdfMatrix
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import TextOperandMetrics
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import TextState
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import estimated_user_text_geometry
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import text_operand_metrics


@dataclass(frozen=True)
class TextShowRewriteDecision:
    text_metrics: TextOperandMetrics
    user_point: tuple[float, float]
    text_rect: RectTuple
    remove: bool


def decide_text_show_rewrite(
    *,
    operands: object,
    ctm: PdfMatrix,
    text_matrix: PdfMatrix,
    text_state: TextState,
    strip_index: RectIndex,
    protected_index: RectIndex,
) -> TextShowRewriteDecision:
    text_metrics = text_operand_metrics(operands)
    user_point, text_rect = estimated_user_text_geometry(
        ctm,
        text_matrix,
        text_state,
        text_length=text_metrics[0],
    )
    remove = strip_index.matches_text_for_removal(
        user_point[0],
        user_point[1],
        text_rect,
    ) and not is_protected_text_op(
        user_point=user_point,
        text_rect=text_rect,
        protected_index=protected_index,
    )
    return TextShowRewriteDecision(
        text_metrics=text_metrics,
        user_point=user_point,
        text_rect=text_rect,
        remove=remove,
    )
