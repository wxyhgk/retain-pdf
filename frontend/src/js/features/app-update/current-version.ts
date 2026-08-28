// Điểm xuất APP_VERSION duy nhất cho app-update sau khi React hóa 3b (blueprint §5).
//
// Re-export trực tiếp APP_VERSION từ generated/app-version.js.
// Cổng architecture-boundaries cấm src/pages/** và src/shared/** import trực tiếp
// src/js/generated/** (artifact sinh sẵn/biên dịch trước). File re-export mỏng này vẫn nằm
// trong thế giới cũ (src/js/features/app-update/) nên không bị cổng đó chặn; thế giới mới lấy
// phiên bản gián tiếp từ đây, không copy literal, không vi phạm boundary, và script cập nhật
// phiên bản (generate-app-version.mjs) chỉ cần sửa một nơi là cả hai bên cùng có hiệu lực.

export { APP_VERSION } from "../../generated/app-version.js";
