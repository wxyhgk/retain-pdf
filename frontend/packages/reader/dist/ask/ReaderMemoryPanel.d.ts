/** 记忆面板（提问窗标题栏的记忆图标打开，2026-11-26）：AI 记下的、你自己加的，分「关于你」和「这本书」两层；
 * 能搜、加、改、删（删了被它替代的旧条恢复）。最上面是「让 AI 使用记忆」：关着时 AI 用不到、也不记新的，已经记下的照样能看、改、删。
 * 术语类的记忆能「加进术语表」（2026-11-27）：在对话里和 AI 商量好的译法存进自己的术语表，以后翻译选这张表就用上。
 * 接口见 docs/api/16-AI/02-主对话和记忆.md。 */
import { type ReactElement } from "react";
import type { AskMemoryRecord } from "@retainpdf/api/ai";
import type { ReaderAskGlossaryPort, ReaderAskMemoriesPort } from "../contracts/ask.js";
/** 能加进术语表的：AI 记成术语的，或这本书里写成「X 译为 Y」这样的（自己加的记不了类别）。 */
export declare function isTermMemory(memory: Pick<AskMemoryRecord, "category" | "scope" | "text">): boolean;
/** 新建术语表时默认的名字。 */
export declare const NEW_GLOSSARY_NAME = "\u9605\u8BFB\u65F6\u5B9A\u7684\u672F\u8BED";
export declare function ReaderMemoryPanel({ port, glossaries, documentId, open, onOpenChange }: {
    port: ReaderAskMemoriesPort;
    glossaries?: ReaderAskGlossaryPort | null;
    documentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}): ReactElement;
//# sourceMappingURL=ReaderMemoryPanel.d.ts.map