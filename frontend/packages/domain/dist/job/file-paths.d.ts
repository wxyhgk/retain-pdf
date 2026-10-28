/** 任务成品里前端会直接拼地址的几个文件；别的成品从 /jobs/:job_id/files 的清单里拿地址。 */
export type JobOutputFileName = "translated.pdf" | "side-by-side.pdf" | "ocr.md";
/** 书的原文 PDF。给了版本就取那一版（重新提交过原文的书），不给取当前这版。 */
export declare function documentSourcePdfPath(documentId: string, version?: string): string;
/** 任务的成品文件。download 让后端按附件回（浏览器直接存盘，不在页面里打开）。 */
export declare function jobOutputFilePath(jobId: string, name: JobOutputFileName, options?: {
    download?: boolean;
}): string;
