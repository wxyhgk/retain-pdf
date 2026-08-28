from __future__ import annotations


# translation_diagnostics Mục nhập Ghi Hợp nhất(Chuỗi sửa chữa độc quyền,Từng bước)。
#
# Hợp đồng:
# - Giữ lại tầng trên cùng dict、Lớp phủ merge,với trình đọc hiện có(Bảng điều khiển gỡ lỗi front-end、Rust đồ thị hình chiếu、
#   debug index、replay Dụng cụ)Hoàn toàn tương thích;
# - Cùng lúc với mỗi bài viết, updates Thêm diagnostics["history"],
#   Duy trì quỹ đạo xử lý của từng giai đoạn——trước đây route_path/degradation_reason/fallback_to
#   Sau khi một trường giá trị đơn được ghi đè bởi một giai đoạn tiếp theo,Lịch sử bị mất;
# - Đọc lại trước khi viết item Bật hiện tại diagnostics,tránh cho"Tạo ảnh chụp nhanh trước、Trung cấp Khác
#   Ghi、Viết lại toàn bộ đoạn văn"Ghi đè im lặng do。


def record_translation_diagnostics(item: dict, stage: str, updates: dict) -> dict:
    diagnostics = dict(item.get("translation_diagnostics") or {})
    diagnostics.update(updates)
    history = list(diagnostics.get("history") or [])
    history.append({"stage": str(stage or ""), **updates})
    diagnostics["history"] = history
    item["translation_diagnostics"] = diagnostics
    return diagnostics


__all__ = ["record_translation_diagnostics"]
