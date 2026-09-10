from __future__ import annotations

from dataclasses import dataclass


MIN_BLOCK_SIZE_PT = 8.0
MIN_FIT_FONT_SIZE_PT = 1.0
MIN_FIT_LEADING_EM = 0.1
MIN_FIRST_LINE_INDENT_PT = 0.0
NO_TARGET_SIZE_PT = 0.0
DEFAULT_COVER_FILL = (1.0, 1.0, 1.0)
CMARKER_PACKAGE = "cmarker"
CMARKER_VERSION = "0.1.8"
MITEX_PACKAGE = "mitex"
MITEX_VERSION = "0.2.6"
FIT_SIZE_HELPER = "pdftr_fit_size"
FIT_LEADING_HELPER = "pdftr_fit_leading"
FIT_MARKDOWN_HELPER = "pdftr_fit_markdown"
FIT_SINGLE_LINE_MARKDOWN_HELPER = "pdftr_fit_single_line_markdown"
FIT_SIZE_EPS_PT = 0.08
FIT_LEADING_EPS_EM = 0.01
FIT_EMERGENCY_MIN_SIZE_PT = 4.2
FIT_EMERGENCY_MIN_SIZE_RATIO = 0.65
FIT_EMERGENCY_MIN_LEADING_EM = 0.20
FIT_EMERGENCY_MIN_LEADING_RATIO = 0.75


@dataclass(frozen=True)
class SingleLineFitConfig:
    min_font_pt: float
    max_font_pt: float
    width_pt: float
    height_pt: float
    shift_up_pt: float


def typst_bool(value: bool) -> str:
    return "true" if value else "false"


def typst_package_imports() -> list[str]:
    return [
        f'#import "@preview/{CMARKER_PACKAGE}:{CMARKER_VERSION}"',
        f'#import "@preview/{MITEX_PACKAGE}:{MITEX_VERSION}": mitex',
    ]


def cover_fill_arg(*, include_fill: bool, use_cover_fill: bool, cover_fill: str) -> str:
    return f", fill: {cover_fill}" if include_fill or use_cover_fill else ""


def first_line_indent_pt(value: float) -> float:
    return max(MIN_FIRST_LINE_INDENT_PT, value)


def single_line_fit_config(
    *,
    width_pt: float,
    height_pt: float,
    font_size_pt: float,
    fit_min_font_size_pt: float,
    fit_max_font_size_pt: float,
    fit_max_height_pt: float,
    fit_target_width_pt: float,
    fit_target_height_pt: float,
    fit_shift_up_pt: float = 0.0,
) -> SingleLineFitConfig:
    return SingleLineFitConfig(
        min_font_pt=max(MIN_FIT_FONT_SIZE_PT, min(fit_min_font_size_pt or font_size_pt, font_size_pt)),
        max_font_pt=max(font_size_pt, fit_max_font_size_pt or font_size_pt),
        width_pt=max(width_pt, fit_target_width_pt or NO_TARGET_SIZE_PT),
        height_pt=max(
            MIN_BLOCK_SIZE_PT,
            max(
                min(height_pt, fit_max_height_pt or height_pt),
                fit_target_height_pt or NO_TARGET_SIZE_PT,
            ),
        ),
        shift_up_pt=max(0.0, fit_shift_up_pt),
    )


__all__ = [
    "MIN_BLOCK_SIZE_PT",
    "DEFAULT_COVER_FILL",
    "CMARKER_PACKAGE",
    "CMARKER_VERSION",
    "FIT_EMERGENCY_MIN_LEADING_EM",
    "FIT_EMERGENCY_MIN_LEADING_RATIO",
    "FIT_EMERGENCY_MIN_SIZE_PT",
    "FIT_EMERGENCY_MIN_SIZE_RATIO",
    "FIT_LEADING_EPS_EM",
    "FIT_LEADING_HELPER",
    "FIT_MARKDOWN_HELPER",
    "MIN_FIT_FONT_SIZE_PT",
    "MIN_FIT_LEADING_EM",
    "FIT_SINGLE_LINE_MARKDOWN_HELPER",
    "FIT_SIZE_EPS_PT",
    "FIT_SIZE_HELPER",
    "MITEX_PACKAGE",
    "MITEX_VERSION",
    "SingleLineFitConfig",
    "cover_fill_arg",
    "first_line_indent_pt",
    "single_line_fit_config",
    "typst_package_imports",
    "typst_bool",
]
