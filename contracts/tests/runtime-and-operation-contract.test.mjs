import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function schema(name) {
  return JSON.parse(readFileSync(resolve(name), "utf8"));
}

test("runtime config keeps the update and redacted view boundaries explicit", () => {
  const contract = schema("runtime-config.v1.schema.json");
  const update = contract.definitions.RuntimeConfigUpdate;
  const view = contract.definitions.RuntimeConfigView;

  assert.deepEqual(Object.keys(update.properties).sort(), [
    "agent_confirmation_mode",
    "agent_runtime",
    "clear_fx_gateway_api_key",
    "clear_llm_api_key",
    "expected_revision",
    "fx_gateway_api_key",
    "fx_gateway_base_url",
    "fx_gateway_credential_ref",
    "fx_model",
    "llm_api_key",
    "llm_base_url",
    "llm_credential_ref",
    "llm_model",
  ]);
  assert.equal(Object.hasOwn(update, "required"), false);
  assert.equal(update.additionalProperties, false);
  assert.deepEqual(contract.definitions.ConfiguredRuntime.enum, ["python", "openai", "fx"]);
  assert.deepEqual(contract.definitions.AgentConfirmationMode.enum, ["explicit", "green_light"]);
  assert.deepEqual(new Set(view.required), new Set(Object.keys(view.properties)));
  assert.equal(view.additionalProperties, false);
  assert.equal(Object.hasOwn(view.properties, "llm_api_key"), false);
  assert.equal(Object.hasOwn(view.properties, "fx_gateway_api_key"), false);
  assert.equal(Object.hasOwn(view.properties, "llm_credential_ref"), true);
  assert.equal(Object.hasOwn(view.properties, "fx_gateway_credential_ref"), true);
});

test("public operation action mirrors Rust CAS and deny-unknown constraints", () => {
  const contract = schema("public-document-operation.v1.schema.json");
  const action = contract.definitions.PublicDocumentOperationActionInput;
  const view = contract.definitions.PublicDocumentOperationView;
  const list = contract.definitions.PublicDocumentOperationListView;

  assert.equal(action.additionalProperties, false);
  assert.deepEqual(action.required, [
    "schema",
    "idempotency_key",
    "expected_status",
    "expected_attempt",
    "expected_program_sha256",
  ]);
  assert.equal(action.properties.schema.const, "document_operation_action_v1");
  assert.equal(action.properties.expected_attempt.minimum, 1);
  assert.equal(action.properties.expected_program_sha256.pattern, "^[0-9A-Fa-f]{64}$");
  assert.deepEqual(
    contract.definitions.DocumentOperationStatus.enum,
    [
      "draft",
      "awaiting_confirmation",
      "queued",
      "running",
      "validating",
      "result_ready",
      "committed",
      "failed",
      "cancelled",
      "ambiguous",
    ],
  );
  assert.deepEqual(new Set(view.required), new Set(Object.keys(view.properties)));
  assert.deepEqual(new Set(list.required), new Set(Object.keys(list.properties)));
  assert.deepEqual(list.required, ["operations", "total", "limit", "offset", "has_more"]);
  assert.equal(list.properties.limit.minimum, 1);
  assert.equal(list.properties.limit.maximum, 100);
});

test("agent calculation contract separates internal bytes from public durable views", () => {
  const contract = schema("agent-calculation.v1.schema.json");
  const create = contract.definitions.CreateAgentCalculationInput;
  const complete = contract.definitions.CompleteAgentCalculationInput;
  const view = contract.definitions.AgentCalculationView;
  const artifact = contract.definitions.AgentCalculationArtifactView;
  const list = contract.definitions.AgentCalculationListView;

  assert.deepEqual(contract.definitions.AgentCalculationToolName.enum, [
    "calculate_expression",
    "calculate_statistics",
    "analyze_table",
    "generate_chart",
  ]);
  assert.deepEqual(contract.definitions.AgentCalculationStatus.enum, [
    "running",
    "completed",
    "failed",
  ]);
  assert.equal(create.additionalProperties, false);
  assert.equal(create.properties.schema.const, "agent_calculation_create_v1");
  assert.equal(complete.additionalProperties, false);
  assert.equal(complete.properties.schema.const, "agent_calculation_complete_v1");
  assert.equal(complete.properties.artifacts.maxItems, 10);
  assert.deepEqual(new Set(view.required), new Set(Object.keys(view.properties)));
  assert.equal(view.additionalProperties, false);
  assert.equal(Object.hasOwn(view.properties, "input_sha256"), false);
  assert.equal(Object.hasOwn(view.properties, "content_base64"), false);
  assert.equal(Object.hasOwn(artifact.properties, "content_base64"), false);
  assert.equal(Object.hasOwn(artifact.properties, "relative_path"), false);
  assert.equal(artifact.properties.kind.const, "svg_chart");
  assert.equal(artifact.properties.mime_type.const, "image/svg+xml");
  assert.deepEqual(list.required, ["calculations", "total", "limit", "offset", "has_more"]);
  assert.equal(contract.security_boundary.result_limit_bytes, 65536);
  assert.equal(contract.security_boundary.artifact_limit_bytes_each, 524288);
});
