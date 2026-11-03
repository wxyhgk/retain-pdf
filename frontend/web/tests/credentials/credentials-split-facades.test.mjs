import test from "node:test";
import assert from "node:assert/strict";

import * as stateFacade from "../../src/features/credentials/domain/state.js";
import * as stateStore from "../../src/features/credentials/domain/state-store.js";
import * as stateSelectors from "../../src/features/credentials/domain/state-selectors.js";
import * as statePort from "../../src/features/credentials/domain/state-port.js";
import * as providerPanels from "../../src/features/credentials/ui/ProviderPanels.jsx";
import * as ocrPanels from "../../src/features/credentials/ui/OcrPanels.jsx";
import * as translationPanel from "../../src/features/credentials/ui/TranslationPanel.jsx";

test("domain/state.js facade re-exports split state modules", () => {
  assert.equal(stateFacade.createCredentialsStore, stateStore.createCredentialsStore);
  assert.equal(stateFacade.ocrTokenFromCredentials, stateSelectors.ocrTokenFromCredentials);
  assert.equal(stateFacade.hasCompleteCredentials, stateSelectors.hasCompleteCredentials);
  assert.equal(stateFacade.createCredentialsStatePort, statePort.createCredentialsStatePort);
});

test("ui/ProviderPanels.jsx keeps its public exports after split", () => {
  assert.equal(providerPanels.OcrPanels, ocrPanels.OcrPanels);
  assert.equal(providerPanels.TranslationPanel, translationPanel.TranslationPanel);
  assert.equal(typeof providerPanels.ProviderPanels, "function");
});
