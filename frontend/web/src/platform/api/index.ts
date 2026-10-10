// composition/external/api — canonical barrel, re-exports from @retainpdf/api
// Source of truth for ALL API clients is @retainpdf/api; this barrel keeps
// the public import surface (pages/home/* stays `from "@/platform/api/index.js"`), but
// delegates to @retainpdf/api. Mock adapters live in ./mocks so mock mode stays identical;
//
// Per-domain canonical×mock dispatch lives in ./domains/*; this file only
// re-exports them. Keep the public export names/paths stable.

export * from "./domains/http.js";
export * from "./domains/agent-runtime-settings.js";
export * from "./domains/credentials.js";
export * from "./domains/jobs.js";
export * from "./domains/library-books.js";
export * from "./domains/jobs-events.js";
export * from "./domains/jobs-artifacts.js";
export * from "./domains/jobs-actions.js";
export * from "./domains/jobs-submit.js";
export * from "./domains/documents.js";
export * from "./domains/collections.js";
export * from "./domains/providers.js";
export * from "./domains/glossaries.js";
export * from "./domains/backups.js";
export * from "./domains/sync.js";
export * from "./domains/translation-debug.js";
export * from "./domains/ai.js";
export * from "./domains/document-operations.js";
export * from "./domains/conversations.js";
export * from "./domains/usage.js";

// search — kept in the barrel (not ./domains) because the architecture gate
// asserts the canonical `@retainpdf/api/search` wiring is present in this file.
import * as MockSearch from "./mocks/search.js";
import { searchLibrary as _canonSearchLibrary } from "@retainpdf/api/search";
import { mockable } from "./domains/_mockable.js";
export const searchLibrary = mockable(_canonSearchLibrary, MockSearch.searchLibrary);
