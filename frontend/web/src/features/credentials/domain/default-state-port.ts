import {
  createCredentialsStatePort,
  type CredentialsFields,
  type CredentialsStatePort,
} from "./state.js";
import {
  bindHiddenCredentialInputPersistence as bindHiddenCredentialDomInputPersistence,
  mirrorCredentialsToHiddenInputs,
  normalizeHiddenCredentialPayload,
  readHiddenCredentialDomInputs,
} from "./hidden-input-dom-port.js";

export const defaultCredentialsStatePort: CredentialsStatePort = createCredentialsStatePort({
  initialState: readHiddenCredentialDomInputs(),
  mirrorToDom: mirrorCredentialsToHiddenInputs,
});

export function applyDefaultCredentialInputs(
  credentialsOrLegacy: Partial<CredentialsFields> | string | null | undefined,
  legacyModelApiKey = "",
): CredentialsFields {
  return defaultCredentialsStatePort.setCredentials(
    normalizeHiddenCredentialPayload(credentialsOrLegacy, legacyModelApiKey),
  );
}

export function bindDefaultHiddenCredentialInputPersistence({
  saveBrowserStoredConfig,
}: {
  saveBrowserStoredConfig?: (credentials: CredentialsFields) => void;
} = {}) {
  bindHiddenCredentialDomInputPersistence({
    credentialsStatePort: defaultCredentialsStatePort,
    readCredentials: defaultCredentialsStatePort.getCredentials,
    saveBrowserStoredConfig,
  });
}
