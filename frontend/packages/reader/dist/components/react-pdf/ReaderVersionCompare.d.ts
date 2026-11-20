import { type ReactElement } from "react";
import type { VersionCompare } from "../../hooks/use-reader-version-compare.js";
/** 「11月18日 18:31」；读不出写空。 */
export declare function versionTimeText(iso: string): string;
export declare function ReaderVersionCompareToggle({ compare }: {
    compare: VersionCompare;
}): ReactElement | null;
/** 对比时书页上方一条：左半写左栏是哪一份（「用这一份」、关掉），右半写正在读的那份。 */
export declare function ReaderVersionCompareBar({ compare }: {
    compare: VersionCompare;
}): ReactElement | null;
//# sourceMappingURL=ReaderVersionCompare.d.ts.map