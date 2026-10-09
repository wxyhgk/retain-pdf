"use strict";

// retain-pdf-rendering/output/pdf/pdf-file
// Host-agnostic: never reference the host application or plugin globals here.
//
// Node-only. A minimal PDF 1.7 writer: numbered objects, Flate-compressed
// streams, a classic cross-reference table. Objects are serialized from
// plain values:
//   number -> fixed-point (at most 4 decimals), true/false/null,
//   PdfName("Type") -> /Type, PdfRef(n) -> n 0 R, PdfRaw("...") -> verbatim,
//   string -> literal string (bytes of latin1; pass PdfHex for binary),
//   array -> [ ... ], plain object -> << /Key value ... >>.

const zlib = require("node:zlib");

class PdfName { constructor(name) { this.name = String(name); } }
class PdfRef { constructor(id) { this.id = id; } }
class PdfRaw { constructor(text) { this.text = String(text); } }
class PdfHex { constructor(buffer) { this.buffer = Buffer.from(buffer); } }

const name = value => new PdfName(value);
const raw = value => new PdfRaw(value);

function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RangeError(`not a finite PDF number: ${value}`);
  if (Number.isInteger(n)) return String(n);
  const text = n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return text === "-0" ? "0" : text;
}

function escapeName(value) {
  return value.replace(/[^!-~]|[#()<>[\]{}/%]/g, c => `#${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function literalString(value) {
  return `(${String(value).replace(/[\\()]/g, c => `\\${c}`).replace(/\r/g, "\\r").replace(/\n/g, "\\n")})`;
}

function serialize(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return num(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return literalString(value);
  if (value instanceof PdfName) return `/${escapeName(value.name)}`;
  if (value instanceof PdfRef) return `${value.id} 0 R`;
  if (value instanceof PdfRaw) return value.text;
  if (value instanceof PdfHex) return `<${value.buffer.toString("hex")}>`;
  if (Array.isArray(value)) return `[${value.map(serialize).join(" ")}]`;
  if (typeof value === "object") {
    const parts = [];
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      parts.push(`/${escapeName(key)} ${serialize(item)}`);
    }
    return `<<${parts.join(" ")}>>`;
  }
  throw new TypeError(`cannot serialize ${typeof value} into a PDF`);
}

class PdfFile {
  constructor() {
    this.objects = [null]; // index = object number; [0] is the free head
  }

  // Reserves an object number (to reference before the body is known).
  reserve() {
    this.objects.push(undefined);
    return new PdfRef(this.objects.length - 1);
  }

  // dict: a plain object; data (Buffer | string): makes it a stream.
  // compress: Flate-encode the data (default true).
  set(ref, dict, data = null, { compress = true } = {}) {
    if (data === null || data === undefined) {
      this.objects[ref.id] = Buffer.from(serialize(dict), "latin1");
      return ref;
    }
    let bytes = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "latin1");
    const head = { ...dict };
    if (compress) {
      bytes = zlib.deflateSync(bytes, { level: 6 });
      head.Filter = name("FlateDecode");
    }
    head.Length = bytes.length;
    this.objects[ref.id] = Buffer.concat([
      Buffer.from(`${serialize(head)}\nstream\n`, "latin1"), bytes, Buffer.from("\nendstream", "latin1")
    ]);
    return ref;
  }

  add(dict, data = null, options = {}) {
    return this.set(this.reserve(), dict, data, options);
  }

  // The whole file; root: the catalog reference, info: optional Info ref.
  toBuffer(root, info = null) {
    const chunks = [Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1")];
    let offset = chunks[0].length;
    const offsets = [0];
    for (let id = 1; id < this.objects.length; id++) {
      const body = this.objects[id];
      if (!body) throw new Error(`PDF object ${id} was reserved but never written`);
      const chunk = Buffer.concat([Buffer.from(`${id} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
      offsets.push(offset);
      chunks.push(chunk);
      offset += chunk.length;
    }
    const size = this.objects.length;
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let id = 1; id < size; id++) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    const trailer = { Size: size, Root: root, Info: info || undefined };
    xref += `trailer\n${serialize(trailer)}\nstartxref\n${offset}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, "latin1"));
    return Buffer.concat(chunks);
  }
}

module.exports = { PdfFile, PdfName, PdfRef, PdfRaw, PdfHex, name, raw, num, serialize };
