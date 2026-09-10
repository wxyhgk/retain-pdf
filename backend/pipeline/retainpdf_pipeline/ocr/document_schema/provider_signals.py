from __future__ import annotations


def body_repair_applied(payload: dict | None) -> bool:
    source = payload or {}
    return bool(
        source.get("body_repair_applied")
        or source.get("provider_body_repair_applied")
    )


def body_repair_role(payload: dict | None) -> str:
    source = payload or {}
    return str(
        source.get(
            "body_repair_role",
            source.get("provider_body_repair_role", ""),
        )
        or ""
    ).strip().lower()


def body_repair_peer_block_id(payload: dict | None) -> str:
    source = payload or {}
    return str(
        source.get(
            "body_repair_peer_block_id",
            source.get("provider_suspected_peer_block_id", ""),
        )
        or ""
    ).strip()


__all__ = [
    "body_repair_applied",
    "body_repair_peer_block_id",
    "body_repair_role",
]
