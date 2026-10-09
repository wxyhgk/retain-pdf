import {
  buildAgentOperationCandidateUrl as _canonBuildAgentOperationCandidateUrl,
  cancelAgentOperation as _canonCancelAgentOperation,
  commitAgentOperation as _canonCommitAgentOperation,
  fetchAgentOperationCandidate as _canonFetchAgentOperationCandidate,
  getAgentOperation as _canonGetAgentOperation,
  listAgentOperations as _canonListAgentOperations,
  retryAgentOperation as _canonRetryAgentOperation,
  runAgentOperation as _canonRunAgentOperation,
} from "@retainpdf/api/document-operations";
import type { AgentOperationView } from "@retainpdf/api/document-operations";
import { mockable } from "./_mockable.js";

export const listAgentOperations = mockable(_canonListAgentOperations, () => ({ operations: [] }));
export const getAgentOperation = async (...args: Parameters<typeof _canonGetAgentOperation>): Promise<AgentOperationView> => (
  _canonGetAgentOperation(...args)
);
export const runAgentOperation = async (...args: Parameters<typeof _canonRunAgentOperation>): Promise<AgentOperationView> => (
  _canonRunAgentOperation(...args)
);
export const cancelAgentOperation = async (...args: Parameters<typeof _canonCancelAgentOperation>): Promise<AgentOperationView> => (
  _canonCancelAgentOperation(...args)
);
export const commitAgentOperation = async (...args: Parameters<typeof _canonCommitAgentOperation>): Promise<AgentOperationView> => (
  _canonCommitAgentOperation(...args)
);
export const retryAgentOperation = async (...args: Parameters<typeof _canonRetryAgentOperation>): Promise<AgentOperationView> => (
  _canonRetryAgentOperation(...args)
);
export const fetchAgentOperationCandidate = async (
  ...args: Parameters<typeof _canonFetchAgentOperationCandidate>
): Promise<Blob> => _canonFetchAgentOperationCandidate(...args);
export const buildAgentOperationCandidateUrl = _canonBuildAgentOperationCandidateUrl;
