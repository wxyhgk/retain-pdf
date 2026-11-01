import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// RetainPDF 网页 ↔ 笔记（Studio）的 postMessage 协议。两边在不同的仓库里各写各的实现，
// 这里钉住消息的样子：每种消息一个定义、方向、握手和能力清单对得上，以及几条典型的对错例子。

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "studio-bridge.v1.schema.json"), "utf8"));
const { definitions } = schema;
// 一条消息是 oneOf 里的一种（文件顶层别的键是说明协议的，不是消息本身）。
const message = { oneOf: schema.oneOf };

// 只认这份契约用到的关键字：$ref、const、enum、type、required、properties、additionalProperties、
// minLength、minimum、items、uniqueItems、oneOf。用到别的关键字时这里会直接报错，不会悄悄放过。
const KNOWN = new Set(["$ref", "const", "enum", "type", "required", "properties", "additionalProperties", "minLength", "minimum", "items", "uniqueItems", "oneOf", "description"]);

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function valid(node, value) {
  for (const key of Object.keys(node)) assert.ok(KNOWN.has(key), `validator does not know "${key}"`);
  if (node.$ref) return valid(definitions[node.$ref.replace("#/definitions/", "")], value);
  if (node.oneOf) return node.oneOf.filter((each) => valid(each, value)).length === 1;
  if ("const" in node && value !== node.const) return false;
  if (node.enum && !node.enum.includes(value)) return false;
  if (node.type) {
    const types = [node.type].flat();
    const actual = typeOf(value);
    if (!types.includes(actual) && !(actual === "integer" && types.includes("number"))) return false;
  }
  if (typeof value === "string" && node.minLength !== undefined && value.length < node.minLength) return false;
  if (typeof value === "number" && node.minimum !== undefined && value < node.minimum) return false;
  if (Array.isArray(value)) {
    if (node.uniqueItems && new Set(value).size !== value.length) return false;
    if (node.items && !value.every((item) => valid(node.items, item))) return false;
  }
  if (typeOf(value) === "object") {
    if ((node.required || []).some((key) => !(key in value))) return false;
    for (const [key, item] of Object.entries(value)) {
      if (node.properties && key in node.properties) {
        if (!valid(node.properties[key], item)) return false;
      } else if (node.additionalProperties === false) {
        return false;
      }
    }
  }
  return true;
}

const head = { protocol: "retainpdf-studio-bridge", v: 1 };
const quote = {
  ...head,
  type: "quote",
  job_id: "20261101112937-ad912a",
  document_id: "doc-1",
  title: "Smart Machine Learning",
  item_id: "p001-b0000",
  page_idx: 0,
  source_text: "Smart Machine Learning for Solving the Full Electron-Nuclear",
  translated_text: "基于量子化学启发波函数拟设的智能机器学习",
};

test("every message has one definition, a direction and the shared head", () => {
  const types = schema.messages.map((message) => message.type);
  assert.deepEqual(types, ["hello", "ready", "theme", "navigate", "quote"]);
  assert.deepEqual(schema.oneOf.map((entry) => entry.$ref), schema.messages.map((message) => `#/definitions/${message.definition}`));
  for (const { type, from, definition } of schema.messages) {
    assert.ok(["studio", "retainpdf"].includes(from), `${type}: from ${from}`);
    const shape = definitions[definition];
    assert.equal(shape.properties.type.const, type, definition);
    assert.equal(shape.additionalProperties, false, `${definition} must reject unknown fields`);
    assert.deepEqual(shape.required.slice(0, 3), ["protocol", "v", "type"], definition);
    assert.equal(shape.properties.protocol.$ref, "#/definitions/Protocol");
    assert.equal(shape.properties.v.$ref, "#/definitions/Version");
  }
  assert.equal(definitions.Protocol.const, schema.protocol);
  assert.equal(schema.embed_query.embed, "studio");
});

test("the handshake goes Studio → RetainPDF and back; features name the other messages", () => {
  const from = Object.fromEntries(schema.messages.map((message) => [message.type, message.from]));
  assert.equal(from.hello, "studio");
  assert.equal(from.ready, "retainpdf");
  assert.deepEqual(definitions.Feature.enum.sort(), Object.keys(from).filter((type) => type !== "hello" && type !== "ready").sort());
});

test("typical messages pass and the near misses do not", () => {
  const good = [
    { ...head, type: "hello", theme: "dark" },
    { ...head, type: "ready", features: ["theme", "navigate", "quote"] },
    { ...head, type: "ready", features: [] },
    { ...head, type: "theme", theme: "light" },
    { ...head, type: "navigate", job_id: "j" },
    { ...head, type: "navigate", job_id: "j", page_idx: 3, block_id: "p004-b0002" },
    quote,
    { ...quote, document_id: null, title: null, translated_text: null },
  ];
  for (const each of good) assert.ok(valid(message, each), JSON.stringify(each));

  const bad = [
    { ...head, type: "hello" },
    { ...head, type: "hello", theme: "sepia" },
    { protocol: "other", v: 1, type: "theme", theme: "light" },
    { ...head, v: 2, type: "theme", theme: "light" },
    { ...head, type: "ready", features: ["quote", "quote"] },
    { ...head, type: "ready", features: ["print"] },
    { ...head, type: "navigate", job_id: "" },
    { ...head, type: "navigate", job_id: "j", page_idx: -1 },
    { ...head, type: "navigate", job_id: "j", page: 1 },
    { ...quote, page_idx: 1.5 },
    { ...quote, url: "http://127.0.0.1:40001/reader.html" },
    (({ translated_text: _, ...rest }) => rest)(quote),
    { ...head, type: "open-notes", job_id: "j" },
  ];
  for (const each of bad) assert.equal(valid(message, each), false, JSON.stringify(each));
});
