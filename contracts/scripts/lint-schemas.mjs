import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const EXPECTED_SCHEMAS = [
  "agent-calculation.v1.schema.json",
  "ai-ask.v1.schema.json",
  "ai-conversations.v1.schema.json",
  "job-status.v1.schema.json",
  "jobs-control.v1.schema.json",
  "library-books.v1.schema.json",
  "pipeline-stdout.v1.schema.json",
  "public-document-operation.v1.schema.json",
  "runtime-config.v1.schema.json",
];

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveLocalRef(schema, ref) {
  assert.match(ref, /^#\//, `only local JSON pointers are allowed: ${ref}`);
  return ref.slice(2).split("/").map(decodePointerSegment).reduce((value, key) => {
    assert.ok(value && Object.hasOwn(value, key), `unresolved schema ref: ${ref}`);
    return value[key];
  }, schema);
}

function collectRefs(value, refs = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  if (typeof value.$ref === "string") refs.push(value.$ref);
  for (const nested of Object.values(value)) collectRefs(nested, refs);
  return refs;
}

const discovered = (await readdir(PACKAGE_ROOT))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
assert.deepEqual(discovered, EXPECTED_SCHEMAS, "the published raw schema set must stay explicit");

const ids = new Set();
for (const fileName of EXPECTED_SCHEMAS) {
  const text = await readFile(resolve(PACKAGE_ROOT, fileName), "utf8");
  const schema = JSON.parse(text);
  const slug = fileName.replace(/\.v1\.schema\.json$/, "");
  assert.equal(typeof schema, "object", `${fileName} must contain an object schema`);
  assert.equal(Array.isArray(schema), false, `${fileName} must not contain an array root`);
  assert.equal(schema.$schema, EXPECTED_DIALECT, `${fileName} must use JSON Schema 2020-12`);
  assert.equal(schema.$id, `retainpdf/contracts/${slug}/v1`, `${fileName} must use the canonical $id`);
  assert.equal(ids.has(schema.$id), false, `duplicate schema $id: ${schema.$id}`);
  ids.add(schema.$id);
  assert.equal(typeof schema.title, "string", `${fileName} must declare title`);
  if (schema.definitions !== undefined) {
    assert.ok(
      schema.definitions && typeof schema.definitions === "object" && !Array.isArray(schema.definitions),
      `${fileName} definitions must be an object`,
    );
  }
  for (const ref of collectRefs(schema)) resolveLocalRef(schema, ref);
}

console.log(`schema lint passed (${EXPECTED_SCHEMAS.length} files)`);
