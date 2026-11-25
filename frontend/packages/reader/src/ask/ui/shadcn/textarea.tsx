// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（ReaderAskWindow.tsx）。
import * as React from "react"
import { cn } from "../lib/utils.js"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
