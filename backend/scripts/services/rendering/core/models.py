from dataclasses import dataclass


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
