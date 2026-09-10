from dataclasses import dataclass
from pathlib import Path


@dataclass
class RenderLineBox:
    text: str
    bbox: list[float]


@dataclass
class RenderTocEntry:
    title: str
    page_label: str
    bbox: list[float]
    number: str = ""
    level: int = 1


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
    font_weight: str = "regular"
    fit_to_box: bool = False
    fit_single_line: bool = False
    fit_min_font_size_pt: float = 0.0
    fit_max_font_size_pt: float = 0.0
    fit_min_leading_em: float = 0.0
    fit_max_height_pt: float = 0.0
    fit_target_width_pt: float = 0.0
    fit_target_height_pt: float = 0.0
    fit_shift_up_pt: float = 0.0
    first_line_indent_pt: float = 0.0
    justify_text: bool = False
    text_color: tuple[float, float, float] = (0, 0, 0)
    cover_fill: tuple[float, float, float] = (1, 1, 1)
    use_cover_fill: bool = False
    math_map: list[dict] | None = None
    skip_reason: str = ""
    source_item_id: str = ""
    preserve_line_breaks: bool = False
    preserved_line_boxes: list[RenderLineBox] | None = None
    toc_entries: list[RenderTocEntry] | None = None


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
    font_weight: str = "regular"
    fit_to_box: bool = False
    fit_single_line: bool = False
    fit_min_font_size_pt: float = 0.0
    fit_max_font_size_pt: float = 0.0
    fit_min_leading_em: float = 0.0
    fit_max_height_pt: float = 0.0
    fit_target_width_pt: float = 0.0
    fit_target_height_pt: float = 0.0
    fit_shift_up_pt: float = 0.0
    first_line_indent_pt: float = 0.0
    justify_text: bool = False
    text_color: tuple[float, float, float] = (0, 0, 0)
    cover_fill: tuple[float, float, float] = (1, 1, 1)
    use_cover_fill: bool = False
    skip_reason: str = ""
    preserve_line_breaks: bool = False
    preserved_line_boxes: list[RenderLineBox] | None = None
    toc_entries: list[RenderTocEntry] | None = None


@dataclass
class RenderPageSpec:
    page_index: int
    page_width_pt: float
    page_height_pt: float
    background_pdf_path: Path | None
    blocks: list[RenderLayoutBlock]
