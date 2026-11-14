import type { JobDiagnosticsView, QualitySummaryView, TranslationDiagnosticsView } from "@retainpdf/contracts/job-reports";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/jobs/:job_id/reports/failure */
export declare function getFailureReport(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<JobDiagnosticsView>;
/** GET /api/v1/jobs/:job_id/reports/quality */
export declare function getQualityReport(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<QualitySummaryView>;
/** GET /api/v1/jobs/:job_id/reports/translation */
export declare function getTranslationReport(apiPrefix: string | undefined, args: {
    job_id: string;
}, options?: RequestOptions): Promise<TranslationDiagnosticsView>;
