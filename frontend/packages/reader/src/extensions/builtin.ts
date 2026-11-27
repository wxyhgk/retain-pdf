// 阅读页自带的扩展，按这个顺序登记（右下角小球里的按钮、右键菜单项、快捷键说明里的组都按这个顺序）。
// 加一个功能：写一个扩展，加在这里。
import { readerAskExtension } from "../ask/ReaderAskExtension.js";
import { readerCompareExtension } from "./builtin/compare.js";
import { readerInkExtension } from "./builtin/ink.js";
import { readerMarkdownExtension } from "./builtin/markdown.js";
import { readerXrefsExtension } from "./builtin/xrefs.js";
import type { ReaderExtension } from "./types.js";

export const BUILTIN_READER_EXTENSIONS: readonly ReaderExtension[] = [readerInkExtension, readerMarkdownExtension, readerCompareExtension, readerXrefsExtension, readerAskExtension];
