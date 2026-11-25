// 拷自 assistant-ui 官方组件（MIT，https://r.assistant-ui.com，elements-collapsible-root），改了引用路径、提示文字换成中文；别的照原样，方便以后对着上游更新。

import { Collapsible } from "radix-ui";
import { forwardRef } from "react";

export const CollapsibleRoot = forwardRef<
  React.ComponentRef<typeof Collapsible.Root>,
  React.ComponentPropsWithoutRef<typeof Collapsible.Root>
>(function CollapsibleRoot(props, ref) {
  return <Collapsible.Root ref={ref} data-slot="collapsible" {...props} />;
});

export function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof Collapsible.CollapsibleTrigger>) {
  return (
    <Collapsible.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

export function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof Collapsible.CollapsibleContent>) {
  return (
    <Collapsible.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  );
}
