import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const EXPECTED_SCHEMAS = [
  "create-job.v1.schema.json",
  "glossaries.v1.schema.json",
  "job-actions.v1.schema.json",
  "job-data.v1.schema.json",
  "job-events.v2.schema.json",
  "job-reports.v1.schema.json",
  "job-status.v1.schema.json",
  "jobs-control.v1.schema.json",
  "library-books.v1.schema.json",
  "library-documents.v1.schema.json",
  "ocr-providers.v1.schema.json",
  "pipeline-stdout.v1.schema.json",
  "reader-data.v1.schema.json",
  "refine-report.v1.schema.json",
  "studio-bridge.v1.schema.json",
  "token-usage.v1.schema.json",
  "translation-revisions.v1.schema.json",
];

// 端点表（`endpoints[]`）每条允许的键。拼错的键（比如 `clientName`）在这里就红，不会悄悄被生成器忽略。
const ENDPOINT_KEYS = new Set([
  "method",
  "path",
  "client_name",
  "transport",
  "query",
  "input",
  "output",
  "audience",
  "proxy_path",
  "rust_view",
  "ts_consumer",
  "note",
  "errors",
  // jobs-control.v1（jobsd 内部接口）自己的键；`op` 是 jobsd 的操作名，`response` 是返回类型，都不是函数名、传输方式。
  "op",
  "seam_origin",
  "semantics",
  "response",
]);
const ENDPOINT_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
// 返回方式。不写等于 json（`{code, data}` 信封）。
const ENDPOINT_TRANSPORTS = new Set(["json", "sse", "binary", "websocket", "raw_json"]);
const CLIENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

function lintEndpoints(fileName, schema, clientNames) {
  if (schema.endpoints === undefined) return;
  assert.ok(Array.isArray(schema.endpoints), `${fileName} endpoints must be an array`);
  for (const [index, endpoint] of schema.endpoints.entries()) {
    const where = `${fileName} endpoints[${index}]`;
    assert.ok(endpoint && typeof endpoint === "object" && !Array.isArray(endpoint), `${where} must be an object`);
    for (const key of Object.keys(endpoint)) {
      assert.ok(ENDPOINT_KEYS.has(key), `${where} has unknown key "${key}" (allowed: ${[...ENDPOINT_KEYS].join(", ")})`);
    }
    assert.ok(ENDPOINT_METHODS.has(endpoint.method), `${where} method must be one of ${[...ENDPOINT_METHODS].join("/")}`);
    assert.equal(typeof endpoint.path, "string", `${where} must declare path`);
    assert.ok(endpoint.path.startsWith("/"), `${where} path must start with /`);
    if (endpoint.transport !== undefined) {
      assert.ok(
        ENDPOINT_TRANSPORTS.has(endpoint.transport),
        `${where} transport must be one of ${[...ENDPOINT_TRANSPORTS].join(", ")}: ${endpoint.transport}`,
      );
    }
    if (endpoint.client_name !== undefined) {
      const name = endpoint.client_name;
      assert.equal(typeof name, "string", `${where} client_name must be a string`);
      assert.match(name, CLIENT_NAME_PATTERN, `${where} client_name must be lowerCamelCase: ${name}`);
      // 生成的函数可能从同一个入口导出，跨契约也不许重名。
      const seen = clientNames.get(name);
      assert.equal(seen, undefined, `${where} client_name "${name}" is already used by ${seen}`);
      clientNames.set(name, `${where} (${endpoint.method} ${endpoint.path})`);
      // 生成器按名字取 definitions 里的类型；写成说明文字的 query/input/output 会让它报错退出。
      for (const slot of ["query", "input", "output"]) {
        if (endpoint[slot] === undefined) continue;
        assert.ok(
          typeof endpoint[slot] === "string" && Object.hasOwn(schema.definitions || {}, endpoint[slot]),
          `${where} ${slot} must name a definition when client_name is set: ${endpoint[slot]}`,
        );
      }
    }
  }
}

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
const clientNames = new Map();
for (const fileName of EXPECTED_SCHEMAS) {
  const text = await readFile(resolve(PACKAGE_ROOT, fileName), "utf8");
  const schema = JSON.parse(text);
  const [, slug, version] = fileName.match(/^(.+)\.v(\d+)\.schema\.json$/);
  assert.equal(typeof schema, "object", `${fileName} must contain an object schema`);
  assert.equal(Array.isArray(schema), false, `${fileName} must not contain an array root`);
  assert.equal(schema.$schema, EXPECTED_DIALECT, `${fileName} must use JSON Schema 2020-12`);
  assert.equal(schema.$id, `retainpdf/contracts/${slug}/v${version}`, `${fileName} must use the canonical $id`);
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
  lintEndpoints(fileName, schema, clientNames);
}

console.log(`schema lint passed (${EXPECTED_SCHEMAS.length} files)`);
