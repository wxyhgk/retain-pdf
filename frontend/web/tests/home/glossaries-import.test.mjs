import test from "node:test";
import assert from "node:assert/strict";
import { readGlossaryFile, mergeGlossaryEntries } from "../../src/features/glossaries/domain/glossary-import.js";

test("file import decodes UTF-8 BOM, GBK and UTF-16 Excel text", async () => {
  const fixtures = [
    ["terms.CSV", new TextEncoder().encode("\ufeff原词,译文\ncat,猫"), "原词,译文\ncat,猫"],
    ["terms.csv", Uint8Array.from([99,97,116,44,0xc3,0xa8]), "cat,猫", "gb18030"],
    ["terms.tsv", Uint8Array.from([0xff,0xfe,99,0,9,0,43,115]), "c\t猫"],
    ["terms.txt", Uint8Array.from([0xfe,0xff,0,99,0,9,115,43]), "c\t猫"],
  ];
  for (const [name, bytes, expected, encoding] of fixtures) {
    const result = await readGlossaryFile(new File([bytes], name), encoding);
    assert.equal(result.text, expected);
  }
});

test("file import auto-detects GBK when UTF-8 is invalid", async () => {
  const result = await readGlossaryFile(new File([Uint8Array.from([99,97,116,44,0xd6,0xd0])], "中文.csv"));
  assert.equal(result.text, "cat,中");
  assert.equal(result.encoding, "gb18030");
});

test("invalid file imports reject empty, unsupported, binary and oversized input", async () => {
  for (const file of [new File([], "empty.csv"), new File(["x,y"], "terms.xlsx"), new File(["a\0,b"], "terms.csv"), new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.csv")]) {
    await assert.rejects(readGlossaryFile(file));
  }
});

test("merge follows case and context keys, keeps incomplete edits, and incoming terms win", () => {
  const base = [
    { source: "DNA", target: "旧译", context: "BIO", match_mode: "case_insensitive" },
    { source: "US", target: "美国", context: "", match_mode: "exact" },
    { source: "unfinished", target: "", level: "canonical" },
  ];
  const incoming = [
    { source: "dna", target: "新译", context: "bio", match_mode: "case_insensitive" },
    { source: "us", target: "我们", context: "", match_mode: "exact" },
    { source: "DNA", target: "另一个语境", context: "chemistry", match_mode: "case_insensitive" },
  ];
  const result = mergeGlossaryEntries(base, incoming, "append");
  assert.deepEqual(result.entries.map(e => e.target), ["新译", "美国", "", "我们", "另一个语境"]);
  assert.equal(result.duplicateCount, 1);
  assert.equal(base[0].target, "旧译");
  assert.deepEqual(mergeGlossaryEntries(base, incoming, "replace").entries, incoming);
});

test("merge enforces the limit after deduplication without truncating the draft", () => {
  const base = Array.from({ length: 1000 }, (_, i) => ({ source: `term${i}`, target: "译文" }));
  assert.throws(() => mergeGlossaryEntries(base, [{ source: "extra", target: "新增" }], "append"), /1000/);
  assert.equal(base.length, 1000);
  assert.equal(mergeGlossaryEntries(base, [{ source: "term0", target: "更新" }], "append").entries.length, 1000);
});
