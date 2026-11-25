// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（ReaderAskWindow.tsx）。

import { type ComponentPropsWithRef, forwardRef } from "react";
import { Slot } from "radix-ui";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../shadcn/tooltip.js";
import { Button } from "../shadcn/button.js";
import { cn } from "../lib/utils.js";

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            {...rest}
            className={cn(
              "aui-button-icon size-6 p-1 active:scale-90",
              className,
            )}
            ref={ref}
          >
            <Slot.Slottable>{children}</Slot.Slottable>
            <span className="aui-sr-only sr-only">{tooltip}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side}>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

TooltipIconButton.displayName = "TooltipIconButton";
