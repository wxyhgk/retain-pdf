import * as MockUsage from "../mocks/usage.js";
import {
  fetchDocumentUsage as _canonFetchDocumentUsage,
  fetchJobUsage as _canonFetchJobUsage,
  fetchUsageSummary as _canonFetchUsageSummary,
} from "@retainpdf/api/usage";
import { mockable } from "./_mockable.js";

export type { UsageSummaryView } from "@retainpdf/api/usage";

export const fetchDocumentUsage = mockable(_canonFetchDocumentUsage, MockUsage.fetchDocumentUsage);
export const fetchUsageSummary = mockable(_canonFetchUsageSummary, MockUsage.fetchUsageSummary);
export const fetchJobUsage = mockable(_canonFetchJobUsage, MockUsage.fetchJobUsage);
