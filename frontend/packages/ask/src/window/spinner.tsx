// 转圈（.ask-spin，在 styles/ask/window.css）：提问窗自己和宿主（阅读页的对话菜单、副对话那一条）都用它，宿主不用直接写这里的类名。
import type { ReactElement } from "react";
import { Loader2 } from "lucide-react";

export function AskSpinner({ size = 12 }: { size?: number }): ReactElement {
  return <Loader2 size={size} className="ask-spin" aria-hidden />;
}
