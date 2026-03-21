from dataclasses import dataclass


@dataclass
class RenderBlock:
    block_id: str
    bbox: list[float]
    inner_bbox: list[float]
    markdown_text: str
    plain_text: str
    render_kind: str
    font_size_pt: float
    leading_em: float
