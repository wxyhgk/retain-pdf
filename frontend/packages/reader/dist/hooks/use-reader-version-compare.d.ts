import type { ReaderVersionOption } from "../contracts/session.js";
import { type ReaderRegion } from "../shared/data/reader-regions.js";
export type ComparedVersion = {
    versionId: string;
    name: string;
    jobId: string;
    url: string;
    /** 那一份的块，source 换成了那一份的译文（左栏当原文栏用）。 */
    regions: ReaderRegion[];
};
export type VersionCompare = {
    /** 能对比：宿主给了端口，这本书至少两份译文。 */
    available: boolean;
    versions: ReaderVersionOption[];
    /** 右边正在读的那一份（任务落在哪一份；找不到用书的当前版本）。 */
    readingVersionId: string;
    compared: ComparedVersion | null;
    /** 正在载入哪一份（版本 id），没在载是空串。 */
    loading: string;
    error: string;
    choose: (versionId: string) => void;
    clear: () => void;
    /** 「用这一份」。 */
    adopt: () => Promise<void>;
};
/** 左栏当原文栏用：source 换成那一份的译文（位置一样，只换字）。 */
export declare function asComparePaneRegions(regions: readonly ReaderRegion[]): ReaderRegion[];
/** 正在读的任务在哪一份里；找不到（合并出来的虚拟任务）用书的当前版本。 */
export declare function readingVersionOf(versions: readonly ReaderVersionOption[], jobId: string, currentVersionId: string | null): string;
/** 把地址里的 job_id 换掉（保留读到的页），阅读页按地址重新载入。 */
export declare function readerUrlWithJob(href: string, jobId: string): string;
export declare function useReaderVersionCompare({ documentId, jobId }: {
    documentId: string;
    jobId: string;
}): VersionCompare;
//# sourceMappingURL=use-reader-version-compare.d.ts.map