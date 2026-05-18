from __future__ import annotations


def item_render_policy(item: dict) -> dict:
    return dict(_item_policy_dict(item))


def item_render_policy_reason(item: dict) -> str:
    policy = _item_policy_dict(item)
    return str(policy.get("reason") or item.get("_render_policy_reason") or "").strip()


def item_formula_protection_role(item: dict) -> str:
    policy = _item_policy_dict(item)
    return str(policy.get("formula_protection_role") or item.get("_render_formula_protection_role") or "").strip().lower()


def item_cleanup_mode(item: dict) -> str:
    policy = _item_policy_dict(item)
    return str(policy.get("cleanup_mode") or item.get("_render_cleanup_mode") or "").strip().lower()


def item_overlay_fill(item: dict) -> str:
    policy = _item_policy_dict(item)
    return str(policy.get("overlay_fill") or item.get("_render_overlay_fill") or "").strip().lower()


def item_requires_visual_cover_only(item: dict) -> bool:
    return item_cleanup_mode(item) == "visual_cover" or bool(item.get("_force_visual_cover_only"))


def item_uses_white_overlay_fill(item: dict) -> bool:
    return item_overlay_fill(item) == "white" or bool(item.get("_render_use_cover_fill"))


def _item_policy_dict(item: dict) -> dict:
    policy = item.get("_render_policy")
    return policy if isinstance(policy, dict) else {}
