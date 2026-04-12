from dataclasses import dataclass
from pathlib import Path


@dataclass
class RenderBlock:
    block_id: str
    bbox: list[float]
    cover_bbox: list[float]
    inner_bbox: list[float]
    markdown_text: str
    plain_text: str
    render_kind: str
    font_size_pt: float
    leading_em: float
    fit_to_box: bool = False
    fit_min_font_size_pt: float = 0.0
    fit_min_leading_em: float = 0.0
    fit_max_height_pt: float = 0.0


@dataclass
class RenderLayoutBlock:
    block_id: str
    page_index: int
    background_rect: list[float]
    content_rect: list[float]
    content_kind: str
    content_text: str
    plain_text: str
    math_map: list[dict]
    font_size_pt: float
    leading_em: float
    fit_to_box: bool = False
    fit_min_font_size_pt: float = 0.0
    fit_min_leading_em: float = 0.0
    fit_max_height_pt: float = 0.0
    skip_reason: str = ""


@dataclass
class RenderPageSpec:
    page_index: int
    page_width_pt: float
    page_height_pt: float
    background_pdf_path: Path | None
    blocks: list[RenderLayoutBlock]
