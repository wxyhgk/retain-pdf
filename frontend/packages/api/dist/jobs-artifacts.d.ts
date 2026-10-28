export type JobArtifactResourceLink = {
    ready?: boolean;
    path?: string;
    url?: string;
    method?: string;
    content_type?: string;
    file_name?: string | null;
    size_bytes?: number | null;
};
export type JobMarkdownArtifactLink = JobArtifactResourceLink & {
    json_path?: string;
    json_url?: string;
    raw_path?: string;
    raw_url?: string;
    images_base_path?: string;
    images_base_url?: string;
};
export type JobArtifactLinks = {
    pdf_ready?: boolean;
    markdown_ready?: boolean;
    bundle_ready?: boolean;
    pdf_url?: string;
    markdown_url?: string;
    bundle_url?: string;
    normalized_document_url?: string;
    normalization_report_url?: string;
    pdf?: JobArtifactResourceLink;
    markdown?: JobMarkdownArtifactLink;
    bundle?: JobArtifactResourceLink;
    normalized_document?: JobArtifactResourceLink;
    normalization_report?: JobArtifactResourceLink;
    [key: string]: unknown;
};
/** /jobs/:id/files 的一个文件。on_demand=true 的（对照 PDF、Word、打包）第一次下载时才生成。 */
export type JobFileEntry = {
    name: string;
    url: string;
    ready: boolean;
    on_demand?: boolean;
    content_type?: string | null;
    size_bytes?: number | null;
    /** 产物登记表里的时间；按需生成、还没生成的为 null。 */
    updated_at?: string | null;
    /** 产出它的阶段（登记表的 source_stage）。 */
    stage?: string | null;
};
/** GET /jobs/:id/files：按成品（output）、页图（pages）、中间产物（internal）列出任务的文件。 */
export type JobFilesView = {
    job_id?: string;
    /** 原文 PDF（属于书，地址在 /documents/:doc/files 下；查不到书的旧任务退回任务自己的地址）。 */
    source?: JobFileEntry | null;
    output?: JobFileEntry[];
    internal?: JobFileEntry[];
    pages?: {
        page_count?: number;
        url_template?: string;
    } | null;
    attempt?: number | null;
};
/** 把 /files 摊平成产物清单的形状（{ job_id, items: [{ artifact_key, resource_url, … }] }）。 */
export declare function jobFilesToArtifactManifest(files: JobFilesView | null | undefined): {
    job_id?: string;
    items: any[];
};
export declare function fetchJobFiles(jobId: string, apiPrefix?: string): Promise<JobFilesView | null>;
/** 任务的产物清单：读 /jobs/:id/files，换成以前 artifacts-manifest 的形状交给下游。 */
export declare function fetchJobArtifactsManifest(jobId: string, apiPrefix?: string): Promise<any>;
export declare function fetchJobMarkdown(jobId: string, apiPrefix?: string): Promise<any>;
