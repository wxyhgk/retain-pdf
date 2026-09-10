// 共享 Button 组件(阶段 B:shadcn 改造)。
//
// 现状(探索 3/3):项目里 74 处裸 <button>、5+ 个独立 class 家族(app-button/
// dialog-close-btn/app-settings-action/button-link/developer-tab...),没有任何
// 统一入口。这次不强求一次性把全部 74 处收拢(改动面太大,阶段 C 逐个对话框
// 换皮时顺带迁移),只提供一个共享落点:
//
// - variant="unstyled"(默认):项目既有视觉系统各自的 bespoke CSS class 直接
//   通过 className 传入,本组件只负责 <button> 元素本身的通用行为(默认
//   type="button",避免裸 <button> 缺省 type="submit" 时误触发所在 <form> 提交
//   ——CredentialsDialog/StatusDetailDialog 的 <form method="dialog"> 就是这个
//   坑的现成案例,本组件把"忘记写 type"这类问题在共享入口收掉)。不叠加
//   shadcn 默认视觉,因为 buttonVariants 的 Tailwind 工具类(bg-primary/
//   rounded-md 等)会和这些已经成熟的 bespoke class 系统正面冲突,现在硬套会
//   制造视觉回归(baseline 抓不到但真实存在)。
// - variant 为 shadcn 6 个标准值之一(default/destructive/outline/secondary/
//   ghost/link)时:直接走 src/components/ui/button.jsx 的 buttonVariants,
//   用于阶段 C 真正换皮的新对话框/新功能,不需要再包一层。
//
// 用法:
//   <Button className="app-button" onClick={...}>保存</Button>            // 沿用现状视觉
//   <Button variant="ghost" size="icon" aria-label="关闭">×</Button>       // 走 shadcn 皮肤

import { cn } from "@retainpdf/ui/lib/utils";
import { buttonVariants } from "@retainpdf/ui/components/ui/button";

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
