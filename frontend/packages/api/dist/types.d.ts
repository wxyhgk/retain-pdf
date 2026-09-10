export type { JobDetailView, JobEventListView, JobEventProgressView, JobEventRawView, JobEventRecord, JobListItemView, JobListView, JobProgressView, JobStatusKind, WorkflowKind, } from "@retainpdf/contracts/job-status";
export type { LibraryBookDetailView, LibraryBookListItemView, LibraryBookListView, LibraryDeleteResultView, } from "@retainpdf/contracts/library-books";
export type ApiResponse<T> = {
    code: number;
    message: string;
    data: T;
};
