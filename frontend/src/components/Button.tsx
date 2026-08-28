// Component Button dùng chung (Giai đoạn B: cải tạo shadcn).
//
// Hiện trạng (Khám phá 3/3): Có 74 chỗ dùng <button> trần, 5+ nhóm class độc lập (app-button/
// dialog-close-btn/app-settings-action/button-link/developer-tab...), không có
// điểm nhập thống nhất. Lần này không ép buộc gom tất cả 74 chỗ cùng lúc (phạm vi thay đổi quá lớn, Giai đoạn C 
// sẽ di chuyển dần khi thay giao diện từng dialog), chỉ cung cấp một điểm tập trung chia sẻ:
//
// - variant="unstyled" (mặc định): Các bespoke CSS class của hệ thống thị giác hiện có được
//   truyền trực tiếp qua className, component này chỉ chịu trách nhiệm về hành vi chung của phần tử <button> (mặc định
//   type="button", tránh việc <button> thiếu type="submit" vô tình kích hoạt submit <form> chứa nó
//   — ví dụ điển hình là <form method="dialog"> trong CredentialsDialog/StatusDetailDialog, 
//   component này sẽ xử lý triệt để các vấn đề như "quên viết type" tại điểm nhập chung). Không áp dụng
//   thị giác mặc định của shadcn, vì các Tailwind utility classes của buttonVariants (bg-primary/
//   rounded-md v.v.) sẽ xung đột trực tiếp với hệ thống bespoke class đã ổn định, nếu ép dùng lúc này
//   sẽ gây ra lỗi thị giác (không bắt được bằng baseline nhưng thực tế có xảy ra).
// - khi variant là một trong 6 giá trị tiêu chuẩn của shadcn (default/destructive/outline/secondary/
//   ghost/link): chạy trực tiếp buttonVariants của src/components/ui/button.jsx,
//   dùng cho các dialog/tính năng mới thực sự thay giao diện trong Giai đoạn C, không cần bọc thêm lớp.
//
// Cách dùng:
//   <Button className="app-button" onClick={...}>Lưu</Button>            // Giữ nguyên thị giác hiện tại
//   <Button variant="ghost" size="icon" aria-label="Đóng">×</Button>       // Dùng skin shadcn

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button.jsx";

const SHADCN_VARIANTS = new Set(["default", "destructive", "outline", "secondary", "ghost", "link"]);

export function Button({
  variant = "unstyled",
  size,
  className,
  type = "button",
  ...props
}: {
  variant?: string;
  size?: string;
  className?: string;
  type?: "button" | "reset" | "submit";
  [key: string]: any;
}) {
  if (!SHADCN_VARIANTS.has(variant)) {
    return <button type={type} className={className} {...props} />;
  }
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant: variant as any, size: size as any }), className)}
      {...props}
    />
  );
}
