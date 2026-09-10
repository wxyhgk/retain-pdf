from __future__ import annotations

from retainpdf_pipeline.render.output.typst import block_config as typst_config


def fit_dimensions(
    *,
    width: float,
    height: float,
    font_size: float,
    leading: float,
    fit_min_font_size_pt: float,
    fit_min_leading_em: float,
    fit_max_height_pt: float,
) -> dict[str, float]:
    fit_min_font = max(typst_config.MIN_FIT_FONT_SIZE_PT, min(fit_min_font_size_pt or font_size, font_size))
    fit_min_leading = max(typst_config.MIN_FIT_LEADING_EM, min(fit_min_leading_em or leading, leading))
    fit_height = max(typst_config.MIN_BLOCK_SIZE_PT, height)
    fit_target_height = max(typst_config.MIN_BLOCK_SIZE_PT, min(height, fit_max_height_pt or height))
    return {
        "fit_min_font": fit_min_font,
        "fit_min_leading": fit_min_leading,
        "fit_height": fit_height,
        "fit_target_height": fit_target_height,
        "width": max(typst_config.MIN_BLOCK_SIZE_PT, width),
    }


__all__ = [
    "fit_dimensions",
]
