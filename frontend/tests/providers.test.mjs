import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_OCR_PROVIDER,
  OCR_PROVIDER_DEFINITIONS,
  getOcrProviderDefinition,
  normalizeOcrProvider,
} from "../src/js/config/providers.js";

test("OCR_PROVIDER_DEFINITIONS registers the local self-hosted provider", () => {
  const local = OCR_PROVIDER_DEFINITIONS.find((item) => item.id === "local");

  assert.ok(local, "expected a 'local' entry in OCR_PROVIDER_DEFINITIONS");
  assert.equal(local.tokenField, "local_token");
  assert.equal(local.supportsValidation, false);
});

test("normalizeOcrProvider('local') returns 'local' instead of falling back to the default", () => {
  assert.equal(normalizeOcrProvider("local"), "local");
  assert.notEqual(normalizeOcrProvider("local"), DEFAULT_OCR_PROVIDER);
});

test("getOcrProviderDefinition('local') resolves to the local provider definition", () => {
  const definition = getOcrProviderDefinition("local");

  assert.equal(definition.id, "local");
});

test("normalizeOcrProvider still falls back to the default for unknown providers", () => {
  assert.equal(normalizeOcrProvider("unknown-provider"), DEFAULT_OCR_PROVIDER);
});
