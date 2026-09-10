import { APP_DIALOG_IDS } from "@/platform/contracts/app-contract.js";

export function isTranslationWorkflowDialogOpen(doc = document) {
  return doc.getElementById?.(APP_DIALOG_IDS.translationWorkflow)?.dataset.open === "1";
}

export function createRecentJobsWorkflowOpenPort({
  isWorkflowOpen = isTranslationWorkflowDialogOpen,
}: any = {}) {
  return Object.freeze({
    isWorkflowOpen,
  });
}

export const defaultRecentJobsWorkflowOpenPort = createRecentJobsWorkflowOpenPort();
