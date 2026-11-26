// 提问窗里「替用户发一句」：常问、互动块里的 @ToAssistant 按钮、「让它修」都用它。AskWindow 给值（runtime.thread.append）。
import { createContext } from "react";

export const AskSendContext = createContext<((text: string) => void) | null>(null);
