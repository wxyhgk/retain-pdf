from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


CleanupMode = Literal["delete_text", "visual_cover", "skip"]
OverlayFillMode = Literal["none", "white", "sampled"]


@dataclass(frozen=True)
class RenderItemPolicy:
    item_id: str
    cleanup_mode: CleanupMode = "delete_text"
    overlay_fill: OverlayFillMode = "none"
    formula_protection_role: str = "none"
    reason: str = "normal"

    def to_payload(self) -> dict[str, str]:
        return {
            "cleanup_mode": self.cleanup_mode,
            "overlay_fill": self.overlay_fill,
            "formula_protection_role": self.formula_protection_role,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class RenderPagePolicy:
    page_has_formula_region: bool
    item_policies: dict[str, RenderItemPolicy]

    def item_policy(self, item_id: str) -> RenderItemPolicy:
        return self.item_policies.get(item_id, RenderItemPolicy(item_id=item_id))
