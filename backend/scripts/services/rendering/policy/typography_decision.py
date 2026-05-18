from __future__ import annotations

from dataclasses import dataclass


FONT_GROWTH_DECISION_KEY = "_body_font_growth_decision"
LEADING_DECISION_KEY = "_body_leading_decision"
PAGE_ANCHOR_DECISION_KEY = "_page_body_anchor_decision"
VERTICAL_BUDGET_KEY = "_body_vertical_budget"


@dataclass(frozen=True)
class FontGrowthDecision:
    seed_font_pt: float
    target_font_pt: float
    slack_ratio: float
    reason: str = "underfilled_body"

    @property
    def grew_pt(self) -> float:
        return max(0.0, self.target_font_pt - self.seed_font_pt)

    def to_payload(self) -> dict[str, float | str]:
        return {
            "seed_font_pt": round(self.seed_font_pt, 3),
            "target_font_pt": round(self.target_font_pt, 3),
            "grew_pt": round(self.grew_pt, 3),
            "slack_ratio": round(self.slack_ratio, 3),
            "reason": self.reason,
        }


@dataclass(frozen=True)
class LeadingDecision:
    leading_em: float
    target_density: float
    leading_cap_em: float
    refit_after_font_unify: bool = False

    def to_payload(self) -> dict[str, float | bool]:
        return {
            "leading_em": round(self.leading_em, 3),
            "target_density": round(self.target_density, 3),
            "leading_cap_em": round(self.leading_cap_em, 3),
            "refit_after_font_unify": self.refit_after_font_unify,
        }


@dataclass(frozen=True)
class PageBodyAnchorDecision:
    target_font_pt: float
    applied: bool

    def to_payload(self) -> dict[str, float | bool]:
        return {
            "target_font_pt": round(self.target_font_pt, 3),
            "applied": self.applied,
        }


@dataclass(frozen=True)
class VerticalBudget:
    font_growth_pt: float
    leading_growth_em: float
    target_density: float
    leading_cap_em: float

    def to_payload(self) -> dict[str, float]:
        return {
            "font_growth_pt": round(max(0.0, self.font_growth_pt), 3),
            "leading_growth_em": round(max(0.0, self.leading_growth_em), 3),
            "target_density": round(self.target_density, 3),
            "leading_cap_em": round(self.leading_cap_em, 3),
        }


def set_font_growth_decision(payload: dict, decision: FontGrowthDecision) -> None:
    payload[FONT_GROWTH_DECISION_KEY] = decision.to_payload()
    payload["_body_underfill_seed_font_pt"] = round(decision.seed_font_pt, 2)
    payload["_body_underfill_font_grew_pt"] = round(decision.grew_pt, 2)
    payload["_body_underfill_font_slack_ratio"] = round(decision.slack_ratio, 3)


def font_growth_grew_pt(payload: dict) -> float:
    decision = payload.get(FONT_GROWTH_DECISION_KEY)
    if isinstance(decision, dict):
        try:
            return float(decision.get("grew_pt") or 0.0)
        except Exception:
            return 0.0
    try:
        return float(payload.get("_body_underfill_font_grew_pt") or 0.0)
    except Exception:
        return 0.0


def font_growth_seed_font_pt(payload: dict, fallback: float) -> float:
    decision = payload.get(FONT_GROWTH_DECISION_KEY)
    if isinstance(decision, dict):
        try:
            return float(decision.get("seed_font_pt") or fallback)
        except Exception:
            return fallback
    try:
        return float(payload.get("_body_underfill_seed_font_pt") or fallback)
    except Exception:
        return fallback


def font_growth_slack_ratio(payload: dict) -> float:
    decision = payload.get(FONT_GROWTH_DECISION_KEY)
    if isinstance(decision, dict):
        try:
            return float(decision.get("slack_ratio") or 0.0)
        except Exception:
            return 0.0
    try:
        return float(payload.get("_body_underfill_font_slack_ratio") or 0.0)
    except Exception:
        return 0.0


def set_leading_decision(payload: dict, decision: LeadingDecision) -> None:
    payload[LEADING_DECISION_KEY] = decision.to_payload()
    payload["_body_dynamic_leading_cap_em"] = round(decision.leading_cap_em, 2)
    payload["_body_leading_target_density"] = round(decision.target_density, 3)
    if decision.refit_after_font_unify:
        payload["_body_leading_refit_after_font_unify"] = True


def leading_refit_after_font_unify(payload: dict) -> bool:
    decision = payload.get(LEADING_DECISION_KEY)
    if isinstance(decision, dict) and bool(decision.get("refit_after_font_unify")):
        return True
    return bool(payload.get("_body_leading_refit_after_font_unify"))


def set_page_body_anchor_decision(payload: dict, decision: PageBodyAnchorDecision) -> None:
    payload[PAGE_ANCHOR_DECISION_KEY] = decision.to_payload()
    payload["_page_body_anchor_font_pt"] = round(decision.target_font_pt, 2)
    if decision.applied:
        payload["_page_body_anchor_font_applied"] = True


def set_vertical_budget(payload: dict, budget: VerticalBudget) -> None:
    payload[VERTICAL_BUDGET_KEY] = budget.to_payload()
