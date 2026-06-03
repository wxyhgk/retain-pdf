from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
from dataclasses import field


@dataclass(frozen=True)
class RiskTrigger:
    kind: str
    severity: str
    score: int
    item_id: str = ""
    other_item_id: str = ""
    metric: float = 0.0
    threshold: float = 0.0
    note: str = ""

    def to_dict(self) -> dict[str, object]:
        payload = asdict(self)
        return {key: value for key, value in payload.items() if value not in {"", 0.0}}


@dataclass(frozen=True)
class BlockRisk:
    item_id: str
    page_index: int
    bbox: list[float]
    estimated_height_pt: float
    height_ratio: float
    font_size_pt: float
    leading_em: float
    formula_count: int = 0
    triggers: list[RiskTrigger] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "item_id": self.item_id,
            "page_index": self.page_index,
            "bbox": self.bbox,
            "estimated_height_pt": round(self.estimated_height_pt, 3),
            "height_ratio": round(self.height_ratio, 3),
            "font_size_pt": round(self.font_size_pt, 3),
            "leading_em": round(self.leading_em, 3),
            "formula_count": self.formula_count,
            "triggers": [trigger.to_dict() for trigger in self.triggers],
        }


@dataclass(frozen=True)
class PageRiskReport:
    page_index: int
    risk_score: int
    risk_level: str
    suggested_action: str
    hard_triggers: list[str]
    triggers: list[RiskTrigger]
    block_risks: list[BlockRisk]
    text_block_count: int
    formula_block_count: int
    image_or_table_block_count: int
    occupied_area_ratio: float

    def to_dict(self) -> dict[str, object]:
        return {
            "page_index": self.page_index,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "suggested_action": self.suggested_action,
            "hard_triggers": self.hard_triggers,
            "triggers": [trigger.to_dict() for trigger in self.triggers],
            "block_risks": [risk.to_dict() for risk in self.block_risks],
            "text_block_count": self.text_block_count,
            "formula_block_count": self.formula_block_count,
            "image_or_table_block_count": self.image_or_table_block_count,
            "occupied_area_ratio": round(self.occupied_area_ratio, 4),
        }


@dataclass(frozen=True)
class RenderRiskReport:
    pages: list[PageRiskReport]
    page_count: int
    high_or_hard_page_count: int
    hard_trigger_count: int
    report_version: str = "render-risk.v1"

    def summary(self) -> dict[str, object]:
        level_counts: dict[str, int] = {}
        action_counts: dict[str, int] = {}
        for page in self.pages:
            level_counts[page.risk_level] = level_counts.get(page.risk_level, 0) + 1
            action_counts[page.suggested_action] = action_counts.get(page.suggested_action, 0) + 1
        return {
            "report_version": self.report_version,
            "page_count": self.page_count,
            "high_or_hard_page_count": self.high_or_hard_page_count,
            "hard_trigger_count": self.hard_trigger_count,
            "level_counts": level_counts,
            "suggested_action_counts": action_counts,
        }

    def to_dict(self) -> dict[str, object]:
        return {
            **self.summary(),
            "pages": [page.to_dict() for page in self.pages],
        }
