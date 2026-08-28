import * as React from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner } from "sonner";

// Dự án không phải Next.js, không có gói next-themes, tokens.css hiện tại chỉ có duy nhất :root
// (không có chế độ tối). Triển khai mặc định của shadcn dựa vào useTheme() của next-themes để đọc chủ đề hiện tại,
// ở đây loại bỏ lớp gián tiếp này, cố định truyền "light", hành vi tương đương và không kéo theo phụ thuộc dư thừa.
const Toaster = ({
  ...props
}) => {
  const theme = "light"

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)"
        } as React.CSSProperties
      }
      {...props} />
  );
}

export { Toaster }
