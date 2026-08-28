from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.core.payload.parts.apply import apply_reconstructed_unit_text
from services.translation.services.postprocess import garbled_reconstruction
from services.translation.services.postprocess.garbled_reconstruction import (
    _apply_reconstruction,
    _clean_reconstructed_text,
)


# hàm reasoning Đầu ra mô hình rò rỉ:trúng mục tiêu "Tôi chọn"/"Đơn giản hơn"/"Vì vậy, đầu ra" Ba marker,
# salvage Nên được rút ra "Vì vậy, đầu ra：" Đã hoàn thành bản dịch sau。
_LEAKY_OUTPUT = "我选择更简洁的表达。因此输出：金属氧化物在高温下保持稳定。"
_SALVAGED = "金属氧化物在高温下保持稳定。"


def _garbled_item() -> dict:
    return {
        "item_id": "p3-b1",
        "block_kind": "text",
        "source_text": "Metal oxides remain stable at high temperature.",
        "protected_source_text": "Metal oxides remain stable at high temperature.",
        "protected_map": [],
        "formula_map": [],
        "final_status": "failed",
    }


def test_clean_reconstructed_text_strips_reasoning_leak() -> None:
    cleaned, salvaged = _clean_reconstructed_text(_LEAKY_OUTPUT, _garbled_item())

    assert cleaned == _SALVAGED
    assert salvaged is True


def test_clean_reconstructed_text_leaves_clean_output_untouched() -> None:
    cleaned, salvaged = _clean_reconstructed_text(_SALVAGED, _garbled_item())

    assert cleaned == _SALVAGED
    assert salvaged is False


def test_apply_reconstruction_writes_cleaned_text_and_breadcrumb(monkeypatch) -> None:
    # Bộ kiểm tra cách ly:Chỉ xác minh _apply_reconstruction Các đĩa là văn bản đã rửa。
    monkeypatch.setattr(garbled_reconstruction, "_validate_reconstruction", lambda *a, **k: [])
    item = _garbled_item()

    _apply_reconstruction([item], _LEAKY_OUTPUT)

    # Tất cả sáu trường đã dịch nằm trên khay salvage Sau văn bản,thay vì đầu ra rò rỉ thô của mô hình。
    for field in (
        "translated_text",
        "protected_translated_text",
        "translation_unit_translated_text",
        "translation_unit_protected_translated_text",
        "group_translated_text",
        "group_protected_translated_text",
    ):
        assert item[field] == _SALVAGED, field

    assert item["final_status"] == "translated"
    assert item["classification_label"] == "llm_reconstructed_garbled"
    assert item["should_translate"] is True
    assert item["skip_reason"] == ""
    assert item["translation_diagnostics"]["reasoning_leak_salvaged"] is True
    assert item["translation_diagnostics"]["route_path"][-1] == "garbled_reconstruction"


def test_apply_reconstructed_unit_text_keeps_all_six_fields_in_sync() -> None:
    # Lối vào thay thế toàn bộ căn hộ:Sáu trường được dịch có cùng giá trị,group_* VÀ translation_unit_* Sẽ không. desync。
    items = [{"item_id": "p1-b1"}, {"item_id": "p1-b2"}]

    apply_reconstructed_unit_text(items, _SALVAGED)

    for item in items:
        values = {
            item["translated_text"],
            item["protected_translated_text"],
            item["translation_unit_translated_text"],
            item["translation_unit_protected_translated_text"],
            item["group_translated_text"],
            item["group_protected_translated_text"],
        }
        assert values == {_SALVAGED}


def test_apply_reconstruction_no_leak_has_no_breadcrumb(monkeypatch) -> None:
    monkeypatch.setattr(garbled_reconstruction, "_validate_reconstruction", lambda *a, **k: [])
    item = _garbled_item()

    _apply_reconstruction([item], _SALVAGED)

    assert item["translated_text"] == _SALVAGED
    assert "reasoning_leak_salvaged" not in item["translation_diagnostics"]
