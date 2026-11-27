// 阅读页自带的扩展，按这个顺序登记（右键菜单项、快捷键说明里的组也按这个顺序）。加一个功能：写一个扩展，加在这里。
import { readerAskExtension } from "../ask/ReaderAskExtension.js";
import type { ReaderExtension } from "./types.js";

export const BUILTIN_READER_EXTENSIONS: readonly ReaderExtension[] = [readerAskExtension];
