// 从 assistant-ui 官方组件（MIT，r.assistant-ui.com）拷来的几个文件要的小工具：合并 Tailwind 类名。
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
