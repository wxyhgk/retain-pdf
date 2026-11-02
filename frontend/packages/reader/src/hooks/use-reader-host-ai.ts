// 阅读页的「AI」交给宿主（放在笔记 Studio 里时，Studio 自己的 AI）：宿主给了 hostAi 适配、握过手才有。
import { useCallback, useSyncExternalStore } from "react";

import { readerHostAi } from "../external.js";

const noSubscribe = () => () => {};
const notAvailable = () => false;

/** `available`：点「AI」交给宿主而不是打开终端；`ask()` 交出去了返回 true，宿主不接（没握手、不认）返回 false。 */
export function useReaderHostAi(): { available: boolean; ask: () => boolean } {
  const hostAi = readerHostAi();
  const getAvailable = hostAi?.available ?? notAvailable;
  const available = useSyncExternalStore(hostAi?.subscribe ?? noSubscribe, getAvailable, getAvailable);
  const ask = useCallback(() => Boolean(hostAi?.available() && hostAi.ask()), [hostAi]);
  return { available, ask };
}
