import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const mirror = new URL("../../backend/contracts/", import.meta.url);
const definitions = JSON.parse(readFileSync(new URL("job-status.v1.schema.json", root), "utf8")).definitions;

test("job status exposes an optional secret-free execution connection", () => {
  const input = definitions.PublicTranslationInput;
  assert.deepEqual(input.properties.execution_connection, { $ref: "#/definitions/ModelConnection" });
  assert.equal(input.required.includes("execution_connection"), false);
  const connection = definitions.ModelConnection;
  assert.equal(connection.additionalProperties, false);
  assert.deepEqual(connection.required, ["id", "revision", "provider", "base_url", "model", "credential_ref", "concurrency"]);
  assert.equal(Object.hasOwn(connection.properties, "api_key"), false);
  assert.equal(connection.properties.credential_ref.pattern, "^cred_[a-z0-9_-]+$");
  assert.deepEqual(connection.properties.provider.enum, ["qwen", "deepseek", "openai_compatible"]);
  assert.deepEqual(connection.properties.thinking.enum, ["auto", "off", "on"]);
  assert.deepEqual(connection.properties.stream.type, ["boolean", "null"]);
});

test("recovery status includes durable execution and blocked states", () => {
  assert.deepEqual(definitions.TranslationRequestRecoveryView.properties.status.enum,
    ["clean", "ambiguous", "corrupt", "blocked", "running", "paused"]);
});

test("backend schema mirrors remain byte-identical to their upstream", {
  skip: !existsSync(mirror) && !existsSync(new URL("../../backend-package.json", import.meta.url))
    ? "standalone npm package has no backend mirror" : false,
}, () => {
  const names = readdirSync(fileURLToPath(mirror)).filter(name => name.endsWith(".schema.json"));
  assert.ok(names.includes("job-status.v1.schema.json"));
  for (const name of names) {
    assert.equal(readFileSync(new URL(name, mirror), "utf8"),
      readFileSync(new URL(name, root), "utf8"), `${name} differs from upstream`);
  }
});
