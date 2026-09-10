import {
  hasCanonicalEventContract,
} from "../presentation/job-stage-presentation-utils.js";
import {
  normalizeSubstageKey,
} from "./job-stage-substage-contract.js";
import { firstNonEmpty } from "../summary/job-status-summary-helpers.js";

export function publicSubstageKeyOf(payload: any = {}) {
  const explicitSubstage = firstNonEmpty(payload.substage, payload.payload?.substage).toLowerCase();
  if (!explicitSubstage) {
    return "";
  }
  const structured = normalizeSubstageKey(explicitSubstage);
  if (structured) {
    return structured;
  }
  return hasCanonicalEventContract(payload) ? "" : explicitSubstage;
}

export function stageSubtypeOfPayload(payload: any = {}) {
  const publicSubstageKey = publicSubstageKeyOf(payload);
  if (publicSubstageKey) {
    return publicSubstageKey;
  }
  return "";
}
