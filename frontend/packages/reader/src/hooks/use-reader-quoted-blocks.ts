// 这本书摘过的段落（宿主 Studio 的摘录栏说的）：阅读页在这些块左边画一道细线（PdfPageSlot）。宿主没给就是空的。
import { useSyncExternalStore } from "react";

import { readerQuotedBlocks } from "../external.js";

const NONE: ReadonlySet<string> = new Set();
const noSubscribe = () => () => {};
const none = () => NONE;

export function useReaderQuotedBlocks(): ReadonlySet<string> {
  const quoted = readerQuotedBlocks();
  const get = quoted?.get ?? none;
  return useSyncExternalStore(quoted?.subscribe ?? noSubscribe, get, get);
}
