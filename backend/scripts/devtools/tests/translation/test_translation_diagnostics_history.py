from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.core.payload.parts.diagnostics import record_translation_diagnostics


def test_top_level_merge_semantics_unchanged() -> None:
    # Hợp đồng:Tầng trên cùng vẫn còn dict、Lớp phủ merge——Trình đọc hiện có(Frontend/Rust/debug index)Không có nhận thức。
    item = {
        "translation_diagnostics": {
            "route_path": ["batch"],
            "degradation_reason": "old",
            "untouched_key": 1,
        }
    }

    record_translation_diagnostics(item, "agent_repair", {"degradation_reason": "new"})

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["degradation_reason"] == "new"
    assert diagnostics["route_path"] == ["batch"]
    assert diagnostics["untouched_key"] == 1


def test_history_preserves_per_stage_updates() -> None:
    # trước đây degradation_reason/fallback_to Loại bỏ lịch sử bị ghi đè bởi giai đoạn ghi sau;
    # Bây giờ ở mỗi giai đoạn của updates đang ở tại history Bên trong。
    item: dict = {}

    record_translation_diagnostics(
        item, "garbled_reconstruction", {"degradation_reason": "garbled_reconstructed"}
    )
    record_translation_diagnostics(
        item, "final_recovery", {"degradation_reason": "blocking_untranslated_recovered"}
    )

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["degradation_reason"] == "blocking_untranslated_recovered"
    assert diagnostics["history"] == [
        {"stage": "garbled_reconstruction", "degradation_reason": "garbled_reconstructed"},
        {"stage": "final_recovery", "degradation_reason": "blocking_untranslated_recovered"},
    ]


def test_rereads_item_state_instead_of_stale_snapshot() -> None:
    # Ghi đè lên các tổn thương ở chế độ cũ:"Tạo ảnh chụp nhanh trước、Được viết bởi một người khác ở giữa、Viết lại toàn bộ đoạn văn"。
    # helper Phải đọc lại trước khi viết item Chẩn đoán hiện tại。
    item = {"translation_diagnostics": {"a": 1}}
    item["translation_diagnostics"] = {**item["translation_diagnostics"], "written_in_between": True}

    record_translation_diagnostics(item, "final_recovery", {"b": 2})

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["written_in_between"] is True
    assert diagnostics["a"] == 1
    assert diagnostics["b"] == 2
