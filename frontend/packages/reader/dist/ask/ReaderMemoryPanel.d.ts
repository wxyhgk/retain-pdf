/** 记忆面板（提问窗标题栏的记忆图标打开，2026-11-26）：AI 记下的、你自己加的，分「关于你」和「这本书」两层；
 * 能搜、加、改、删（删了被它替代的旧条恢复）。最上面是「让 AI 使用记忆」：关着时 AI 用不到、也不记新的，已经记下的照样能看、改、删。
 * 接口见 docs/api/16-AI/02-主对话和记忆.md。 */
import { type ReactElement } from "react";
import type { ReaderAskMemoriesPort } from "../contracts/ask.js";
export declare function ReaderMemoryPanel({ port, documentId, open, onOpenChange }: {
    port: ReaderAskMemoriesPort;
    documentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}): ReactElement;
//# sourceMappingURL=ReaderMemoryPanel.d.ts.map