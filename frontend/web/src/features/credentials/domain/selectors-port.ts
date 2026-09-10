import {
  hasCompleteCredentials,
  ocrTokenFromCredentials,
} from "./state.js";
import { defaultCredentialsStatePort } from "./default-state-port.js";

export function readCredentialInputs(credentialsStatePort = defaultCredentialsStatePort) {
  return credentialsStatePort.getCredentials();
}

export function credentialOcrToken(
  credentials = readCredentialInputs(),
  options: any = {},
) {
  return ocrTokenFromCredentials(credentials, options);
}

export function hasCompleteCredentialInputs(
  credentials = readCredentialInputs(),
  options: any = {},
) {
  return hasCompleteCredentials(credentials, options);
}
