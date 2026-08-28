// AppUpdateBanner tình hình rõ ràng dialog Trạng thái bật/tắt——thuần UI Tạm thời(Quy hoạch tổng thể「Chính sách trạng thái」thứ 5
// đường:Hiện trạng không phải là store Có gì trong,Không chuyển tiếp sau khi viết lại store)。bản xứ useState Chỉ cần làm điều đó,không
// Cần dialog-store.js Cơ chế chia sẻ cây con đó:Button vs. dialog Bây giờ sáp nhập vào cùng một
// AppUpdateBanner.jsx(kế hoạch xây dựng §5),Không thể, "Trans-subtree"Kịch bản mở và đóng。

import { useState, type Dispatch, type SetStateAction } from "react";

export function useAppUpdateDialogOpen(
  initialOpen = false,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(initialOpen);
  return [open, setOpen];
}
