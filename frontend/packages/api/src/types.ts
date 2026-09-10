// Wire DTOs are generated from the versioned schemas. Keep the generic API
// envelope local because the schemas describe the envelope's `data` payload.
export type {
  JobDetailView,
  JobEventListView,
  JobEventProgressView,
  JobEventRawView,
  JobEventRecord,
  JobListItemView,
  JobListView,
  JobProgressView,
  JobStatusKind,
  WorkflowKind,
} from "@retainpdf/contracts/job-status";
export type {
  LibraryBookDetailView,
  LibraryBookListItemView,
  LibraryBookListView,
  LibraryDeleteResultView,
} from "@retainpdf/contracts/library-books";

export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};
