from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import IDENTITY_MATRIX
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import PdfMatrix
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import matrix_from_operands
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import mul_matrix
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import to_float
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import TEXT_DEFAULT_RENDER_MODE
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import TextOperandMetrics
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import TextState
from retainpdf_pipeline.render.source_cleanup.pdf.text_ops import text_advance_tx


StateHandler = Callable[["ContentStreamState", object], None]


@dataclass
class ContentStreamState:
    ctm: PdfMatrix = IDENTITY_MATRIX
    text_matrix: PdfMatrix = IDENTITY_MATRIX
    line_matrix: PdfMatrix = IDENTITY_MATRIX
    leading: float = 0.0
    text_state: TextState | None = None

    def __post_init__(self) -> None:
        if self.text_state is None:
            self.text_state = TextState(render_mode=TEXT_DEFAULT_RENDER_MODE)
        self._ctm_stack: list[PdfMatrix] = []
        self._text_state_stack: list[TextState] = []

    def apply_state_operator(self, op: str, operands: object) -> bool:
        handler = _STATE_HANDLERS.get(op)
        if handler is None:
            return False
        handler(self, operands)
        return True

    def prepare_quote_text_show(self, op: str, operands: object) -> None:
        if op == '"' and len(operands) >= 3:
            self.text_state.set_word_spacing(to_float(operands[0], self.text_state.word_spacing))
            self.text_state.set_char_spacing(to_float(operands[1], self.text_state.char_spacing))
        self.move_text(0, -self.leading)

    def advance_text(
        self,
        operands: object,
        *,
        text_metrics: TextOperandMetrics | None = None,
    ) -> None:
        self.text_matrix = mul_matrix(
            self.text_matrix,
            (
                1,
                0,
                0,
                1,
                text_advance_tx(
                    self.text_matrix,
                    operands,
                    text_metrics=text_metrics,
                    text_state=self.text_state,
                ),
                0,
            ),
        )

    def move_text(self, tx: float, ty: float) -> None:
        move = (1, 0, 0, 1, tx, ty)
        self.line_matrix = mul_matrix(self.line_matrix, move)
        self.text_matrix = self.line_matrix

    def push_graphics_state(self, _: object) -> None:
        self._ctm_stack.append(self.ctm)
        self._text_state_stack.append(self.text_state.copy())

    def pop_graphics_state(self, _: object) -> None:
        self.ctm = self._ctm_stack.pop() if self._ctm_stack else IDENTITY_MATRIX
        self.text_state = (
            self._text_state_stack.pop()
            if self._text_state_stack
            else TextState(render_mode=TEXT_DEFAULT_RENDER_MODE)
        )

    def concat_matrix(self, operands: object) -> None:
        matrix = matrix_from_operands(operands)
        if matrix is not None:
            self.ctm = mul_matrix(self.ctm, matrix)

    def begin_text(self, _: object) -> None:
        self.text_matrix = IDENTITY_MATRIX
        self.line_matrix = self.text_matrix

    def set_text_matrix(self, operands: object) -> None:
        matrix = matrix_from_operands(operands)
        if matrix is not None:
            self.text_matrix = matrix
            self.line_matrix = matrix

    def move_text_from_operands(self, operands: object) -> None:
        if len(operands) < 2:
            return
        self.move_text(to_float(operands[0]), to_float(operands[1]))

    def set_leading_and_move_text(self, operands: object) -> None:
        if len(operands) < 2:
            return
        ty = to_float(operands[1])
        self.leading = -ty
        self.move_text(to_float(operands[0]), ty)

    def set_leading(self, operands: object) -> None:
        if operands:
            self.leading = to_float(operands[0])

    def set_font(self, operands: object) -> None:
        if len(operands) >= 2:
            self.text_state.set_font_size(to_float(operands[1], self.text_state.font_size))

    def set_char_spacing(self, operands: object) -> None:
        if operands:
            self.text_state.set_char_spacing(to_float(operands[0], self.text_state.char_spacing))

    def set_word_spacing(self, operands: object) -> None:
        if operands:
            self.text_state.set_word_spacing(to_float(operands[0], self.text_state.word_spacing))

    def set_horizontal_scaling(self, operands: object) -> None:
        if operands:
            self.text_state.set_horizontal_scaling(to_float(operands[0], self.text_state.horizontal_scaling * 100.0))

    def set_rise(self, operands: object) -> None:
        if operands:
            self.text_state.set_rise(to_float(operands[0], self.text_state.rise))

    def set_render_mode(self, operands: object) -> None:
        if operands:
            self.text_state.set_render_mode(int(to_float(operands[0], TEXT_DEFAULT_RENDER_MODE)))

    def next_line(self, _: object) -> None:
        self.move_text(0, -self.leading)


_STATE_HANDLERS: dict[str, StateHandler] = {
    "q": ContentStreamState.push_graphics_state,
    "Q": ContentStreamState.pop_graphics_state,
    "cm": ContentStreamState.concat_matrix,
    "BT": ContentStreamState.begin_text,
    "Tm": ContentStreamState.set_text_matrix,
    "Td": ContentStreamState.move_text_from_operands,
    "TD": ContentStreamState.set_leading_and_move_text,
    "TL": ContentStreamState.set_leading,
    "Tf": ContentStreamState.set_font,
    "Tc": ContentStreamState.set_char_spacing,
    "Tw": ContentStreamState.set_word_spacing,
    "Tz": ContentStreamState.set_horizontal_scaling,
    "Ts": ContentStreamState.set_rise,
    "Tr": ContentStreamState.set_render_mode,
    "T*": ContentStreamState.next_line,
}
