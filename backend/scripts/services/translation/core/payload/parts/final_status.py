from __future__ import annotations


# payload item Trước final_status Phễu được chỉ định duy nhất。
#
# Ngữ nghĩa học tiểu bang:
# - ""                    Chưa đóng(pending)
# - "translated"          Đã tạo bản dịch
# - "partially_translated" Đã hạ cấp bản dịch quy trình vệ sinh(reasoning tiết lộ salvage、Khu vực lân cậntiết lộCắt, v.v.)
# - "failed"              Dịch không thành công,Đang chờ sửa túi dây chuyền
# - "kept_origin"         Giữ bản gốc theo chính sách
#
# Chỉ chuyển tiền được tuyên bố là bị cấm:Không được hạ cấp bản dịch thành công xuống failed。
# Chuỗi sửa chữa(Tái thiết bị bị xáo trộn/agent repair/Đóng cửa cuối cùng)Chỉ được phép failed Pullback thành công,Đảo ngược là vi phạm。
#
# v1 Chỉ Quan Sát Không Có Đường Dây Nghe Xen:Vi phạm được ghi như bình thường,nhưng trong translation_diagnostics.final_status_violations
# Để lại Breadcrumbs。Chờ cho nhiệm vụ thực sự chứng minh rằng vi phạm không xảy ra lần nữa(hoặc chi xác nhận bug Sửa lỗi)xong,Tăng cấp thành Hard Block một lần nữa。

PENDING_STATUS = ""
TRANSLATED_STATUS = "translated"
PARTIALLY_TRANSLATED_STATUS = "partially_translated"
FAILED_STATUS = "failed"
KEPT_ORIGIN_STATUS = "kept_origin"

KNOWN_FINAL_STATUSES = frozenset(
    {
        PENDING_STATUS,
        TRANSLATED_STATUS,
        PARTIALLY_TRANSLATED_STATUS,
        FAILED_STATUS,
        KEPT_ORIGIN_STATUS,
    }
)

_FORBIDDEN_TRANSITIONS = frozenset(
    {
        (TRANSLATED_STATUS, FAILED_STATUS),
        (PARTIALLY_TRANSLATED_STATUS, FAILED_STATUS),
    }
)


def final_status_violation(previous: str, next_status: str) -> str:
    if next_status not in KNOWN_FINAL_STATUSES:
        return f"unknown_status:{next_status}"
    if (previous, next_status) in _FORBIDDEN_TRANSITIONS:
        return f"demotion:{previous}->{next_status}"
    return ""


def set_final_status(item: dict, status: str) -> None:
    previous = str(item.get("final_status", "") or "")
    next_status = str(status or "")
    violation = final_status_violation(previous, next_status)
    if violation:
        diagnostics = dict(item.get("translation_diagnostics") or {})
        violations = list(diagnostics.get("final_status_violations") or [])
        violations.append(violation)
        diagnostics["final_status_violations"] = violations
        item["translation_diagnostics"] = diagnostics
    item["final_status"] = next_status


__all__ = [
    "FAILED_STATUS",
    "KEPT_ORIGIN_STATUS",
    "KNOWN_FINAL_STATUSES",
    "PARTIALLY_TRANSLATED_STATUS",
    "PENDING_STATUS",
    "TRANSLATED_STATUS",
    "final_status_violation",
    "set_final_status",
]
