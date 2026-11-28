import { type VersionCompare } from "../../hooks/use-reader-version-compare.js";
import type { ReaderComparedDocument, ReaderExtension, ReaderToolbarItem } from "../types.js";
/** 「对照」后面的 ▾：这本书只有一份译文（或宿主没给版本端口）就没有。 */
export declare function compareToolbarItem(compare: VersionCompare): ReaderToolbarItem | null;
/** 两栏书页上的水印：左边是对比的那份，右边是正在读的那份（名字、时间）。 */
export declare function comparedDocumentOf(compare: VersionCompare): ReaderComparedDocument | null;
export declare const readerCompareExtension: ReaderExtension;
//# sourceMappingURL=compare.d.ts.map