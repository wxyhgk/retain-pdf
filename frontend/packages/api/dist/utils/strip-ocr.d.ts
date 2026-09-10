/**
 * stripOcrSuffix — centralized helper for the historical mono-job "-ocr" suffix.
 *
 * Historical context:
 *   Mono-job workflows once appended "-ocr" to the root job id to represent
 *   the OCR-only variant (e.g. "abc123" → "abc123-ocr").  Library deletion
 *   and recent-jobs filtering stripped this suffix to operate on the root id
 *   via `jobId.replace(/-ocr$/, "")`.
 *
 *   This heuristic is now legacy. A naive replace will also mangle legitimate
 *   IDs that happen to end with "-ocr" (e.g. "report-ocr" where "-ocr" is part
 *   of the real human-given name, not a variant suffix).  The backend does not
 *   yet provide an explicit parent/child field, so callers must use this helper
 *   to keep the edge case documented and test-covered in one place.
 *
 * Current behaviour:
 *   Strip a single trailing "-ocr" if present after trimming. This preserves
 *   IDs that merely contain "-ocr" elsewhere (e.g. "my-ocr-report") but still
 *   strips "report-ocr" — the documented edge case. See TODO below.
 *
 * TODO:
 *   Replace heuristic with an explicit flag (e.g. parentJobId / isOcrVariant)
 *   or a server-issued canonical id. Until then, any new job id that
 *   legitimately ends with "-ocr" must be routed through this helper so the
 *   collision is visible in tests.
 *
 * @param jobId - raw job id (may contain surrounding whitespace)
 * @returns job id with trailing "-ocr" stripped, or trimmed input unchanged
 */
export declare function stripOcrSuffix(jobId: string): string;
