import * as React from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner } from "sonner";

// 项目不是 Next.js,没有 next-themes 包,tokens.css 目前也只有单一 :root
// (无暗色模式)。shadcn 默认实现靠 next-themes 的 useTheme() 读取当前主题,
// 这里去掉这层间接,固定传 "light",行为等价且不引入多余依赖。
const Toaster = ({
  ...props
}: React.ComponentProps<typeof Sonner>) => {
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
