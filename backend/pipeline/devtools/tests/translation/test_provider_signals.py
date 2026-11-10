from __future__ import annotations

from retainpdf_translation.core.provider_signals import (
    body_repair_applied,
    body_repair_peer_block_id,
    body_repair_role,
)


def test_provider_body_repair_signals_accept_canonical_and_old_names() -> None:
    canonical = {
        "body_repair_applied": True,
        "body_repair_role": "Donor",
        "body_repair_peer_block_id": "p001-b0002",
    }
    legacy = {
        "provider_body_repair_applied": True,
        "provider_body_repair_role": "Slot",
        "provider_suspected_peer_block_id": "p001-b0001",
    }

    assert body_repair_applied(canonical) is True
    assert body_repair_role(canonical) == "donor"
    assert body_repair_peer_block_id(canonical) == "p001-b0002"
    assert body_repair_applied(legacy) is True
    assert body_repair_role(legacy) == "slot"
    assert body_repair_peer_block_id(legacy) == "p001-b0001"


def test_provider_body_repair_signals_default_to_empty() -> None:
    assert body_repair_applied(None) is False
    assert body_repair_role({}) == ""
    assert body_repair_peer_block_id({}) == ""
