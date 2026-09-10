from __future__ import annotations

from typing import Literal


RedactionStrategy = Literal[
    "auto",
    "text_layer_only",
    "visual_cover",
    "visual_cover_and_remove_text",
    "text_redaction",
    "visual_only",
    "visual_and_text",
]

RedactionRoute = Literal[
    "auto",
    "text_layer_only",
    "visual_cover",
    "visual_cover_and_remove_text",
]

DEFAULT_REDACTION_ROUTE: RedactionRoute = "auto"

_ALIASES: dict[str, RedactionRoute] = {
    "auto": "auto",
    "text_layer_only": "text_layer_only",
    "text_redaction": "text_layer_only",
    "visual_cover": "visual_cover",
    "visual_only": "visual_cover",
    "visual_cover_and_remove_text": "visual_cover_and_remove_text",
    "visual_and_text": "visual_cover_and_remove_text",
}


def resolve_redaction_route(
    strategy: str | None,
    *,
    cover_only: bool = False,
) -> RedactionRoute:
    if cover_only and not strategy:
        return "visual_cover"
    if not strategy:
        return DEFAULT_REDACTION_ROUTE
    normalized = strategy.strip().lower()
    route = _ALIASES.get(normalized)
    if route is None:
        raise ValueError(
            "unsupported redaction strategy: "
            f"{strategy!r}; expected auto, text_layer_only, visual_cover, or visual_cover_and_remove_text"
        )
    return route
