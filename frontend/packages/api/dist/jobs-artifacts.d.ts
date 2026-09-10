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
/**
 * Read the stable, public artifact projection used by the Reader.
 * The detailed manifest is intentionally a separate endpoint and can be empty
 * for older completed jobs even when published downloads are available.
 */
export declare function fetchJobArtifacts(jobId: string, apiPrefix?: string): Promise<JobArtifactLinks | null>;
export declare function fetchJobArtifactsManifest(jobId: string, apiPrefix?: string): Promise<any>;
export declare function fetchJobMarkdown(jobId: string, apiPrefix?: string): Promise<any>;
export declare function fetchJobMarkdownDocument(jobId: string, apiPrefix?: string): Promise<any>;
