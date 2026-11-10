from __future__ import annotations

# OCR 补正文时写下的修补标记（body_repair_*，旧名 provider_body_repair_*），翻译模板记录读它。
# 以前的源头在 OCR 包，那份没有生产代码用，2026-11 删了，改以这份为准；
# 渲染包 render/semantics/provider_signals.py 是这份的副本（阶段之间不互相 import）。


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
