// 控件由宿主（Studio）画：两边都说了才算（adapters.ts 的 hostChrome）；没给、还没握手都是 false，阅读页照旧自己画。
import { useSyncExternalStore } from "react";

import { readerHostChrome } from "../external.js";

const noSubscribe = () => () => {};
const no = () => false;

export function useReaderHostChromeActive(): boolean {
  const chrome = readerHostChrome();
  const get = chrome?.active ?? no;
  return useSyncExternalStore(chrome?.subscribe ?? noSubscribe, get, get);
}
