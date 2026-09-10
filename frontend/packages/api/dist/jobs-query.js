// jobs-query — alias barrel for @retainpdf/api/jobs-query entrypoint
// Canonical implementation lives in ./jobs.ts; this module re-exports it
// so consumers can import from "@retainpdf/api/jobs-query" (legacy path from frontend/web/src/js/api/jobs-query.ts)
export { fetchJobList, fetchJobPayload } from "./jobs.js";
