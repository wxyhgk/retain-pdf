import * as MockQuality from "../mocks/quality.js";
import {
  fetchQualityItems as _canonFetchQualityItems,
  fetchQualitySummary as _canonFetchQualitySummary,
} from "@retainpdf/api/quality";
import { mockable } from "./_mockable.js";

export type { QualityItem, QualityItemKind, QualityItemsView, QualitySummaryView } from "@retainpdf/api/quality";

export const fetchQualitySummary = mockable(_canonFetchQualitySummary, MockQuality.fetchQualitySummary);
export const fetchQualityItems = mockable(_canonFetchQualityItems, MockQuality.fetchQualityItems);
