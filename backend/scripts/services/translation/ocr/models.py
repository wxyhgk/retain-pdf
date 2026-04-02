from dataclasses import dataclass


@dataclass
class TextItem:
    item_id: str
    page_idx: int
    block_idx: int
    block_type: str
    bbox: list[float]
    text: str
    segments: list[dict]
    lines: list[dict]
    metadata: dict
