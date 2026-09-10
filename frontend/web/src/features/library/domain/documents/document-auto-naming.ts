type AutoNamingJob = Record<string, unknown> & {
  job_id?: string;
  id?: string;
  document_id?: string;
  workflow?: string;
  job_type?: string;
  status?: string;
};

type MetadataSuggestion = Record<string, unknown> & {
  source_job_id?: string;
  fields?: string[];
  applied?: boolean;
};

export type DocumentAutoNamingDependencies = {
  fetchDocumentByJobId: (jobId: string) => Promise<Record<string, unknown> | null>;
  fetchSuggestions: (documentId: string) => Promise<MetadataSuggestion[]>;
  createSuggestion: (
    documentId: string,
    payload: { job_id: string; fields: ["title"]; apply_if_default: true },
  ) => Promise<MetadataSuggestion>;
  onApplied?: (input: { documentId: string; jobId: string; suggestion: MetadataSuggestion }) => void;
  onError?: (error: unknown, input: { documentId: string; jobId: string }) => void;
};

function jobIdOf(job: AutoNamingJob): string {
  return `${job.job_id || job.id || ""}`.trim();
}

function supportsTitleSuggestion(job: AutoNamingJob): boolean {
  if (`${job.status || ""}`.trim().toLowerCase() !== "succeeded") return false;
  const workflow = `${job.workflow || job.job_type || ""}`.trim().toLowerCase();
  return workflow === "ocr"
    || workflow === "book"
    || workflow === "translate"
    || workflow === "translation";
}

function suggestionMatchesJob(suggestion: MetadataSuggestion, jobId: string): boolean {
  return `${suggestion.source_job_id || ""}`.trim() === jobId
    && Array.isArray(suggestion.fields)
    && suggestion.fields.includes("title");
}

/**
 * Job runtime 的窄副作用端口：只在 OCR-backed 任务成功后创建一次标题建议。
 * 后端负责判断默认标题、title_locked 与原子应用；前端不推断标题是否安全。
 */
export function createDocumentAutoNaming({
  fetchDocumentByJobId,
  fetchSuggestions,
  createSuggestion,
  onApplied,
  onError,
}: DocumentAutoNamingDependencies) {
  const completedJobIds = new Set<string>();
  const inFlightByJobId = new Map<string, Promise<MetadataSuggestion | null>>();

  async function run(job: AutoNamingJob): Promise<MetadataSuggestion | null> {
    if (!supportsTitleSuggestion(job)) return null;
    const jobId = jobIdOf(job);
    if (!jobId || completedJobIds.has(jobId)) return null;
    const existingFlight = inFlightByJobId.get(jobId);
    if (existingFlight) return existingFlight;

    const flight = (async () => {
      let documentId = `${job.document_id || ""}`.trim();
      try {
        if (!documentId) {
          const document = await fetchDocumentByJobId(jobId);
          documentId = `${document?.document_id || document?.id || ""}`.trim();
        }
        if (!documentId) return null;

        const suggestions = await fetchSuggestions(documentId);
        const persisted = suggestions.find((suggestion) => suggestionMatchesJob(suggestion, jobId));
        if (persisted) {
          completedJobIds.add(jobId);
          return persisted;
        }

        const suggestion = await createSuggestion(documentId, {
          job_id: jobId,
          fields: ["title"],
          apply_if_default: true,
        });
        completedJobIds.add(jobId);
        if (suggestion?.applied) onApplied?.({ documentId, jobId, suggestion });
        return suggestion;
      } catch (error) {
        onError?.(error, { documentId, jobId });
        return null;
      } finally {
        inFlightByJobId.delete(jobId);
      }
    })();

    inFlightByJobId.set(jobId, flight);
    return flight;
  }

  return Object.freeze({ run });
}
