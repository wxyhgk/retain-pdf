import {
  hasCompleteCredentials,
  ocrTokenFromCredentials,
} from "./state.js";
import { defaultCredentialsStatePort } from "./default-state-port.js";
import type { OcrTokenOptions } from "./state.js";

export function readCredentialInputs(credentialsStatePort = defaultCredentialsStatePort) {
  return credentialsStatePort.getCredentials();
}

export function credentialOcrToken(
  credentials = readCredentialInputs(),
  options: OcrTokenOptions = {},
) {
  return ocrTokenFromCredentials(credentials, options);
}

export function hasCompleteCredentialInputs(
  credentials = readCredentialInputs(),
  options: OcrTokenOptions = {},
) {
  return hasCompleteCredentials(credentials, options);
}
