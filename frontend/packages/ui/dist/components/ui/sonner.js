import { jsx as _jsx } from "react/jsx-runtime";
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon, } from "lucide-react";
import { Toaster as Sonner } from "sonner";
// 项目不是 Next.js,没有 next-themes 包,tokens.css 目前也只有单一 :root
// (无暗色模式)。shadcn 默认实现靠 next-themes 的 useTheme() 读取当前主题,
// 这里去掉这层间接,固定传 "light",行为等价且不引入多余依赖。
const Toaster = ({ ...props }) => {
    const theme = "light";
    return (_jsx(Sonner, { theme: theme, className: "toaster group", icons: {
            success: _jsx(CircleCheckIcon, { className: "size-4" }),
            info: _jsx(InfoIcon, { className: "size-4" }),
            warning: _jsx(TriangleAlertIcon, { className: "size-4" }),
            error: _jsx(OctagonXIcon, { className: "size-4" }),
            loading: _jsx(Loader2Icon, { className: "size-4 animate-spin" }),
        }, style: {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)"
        }, ...props }));
};
export { Toaster };
//# sourceMappingURL=sonner.js.map