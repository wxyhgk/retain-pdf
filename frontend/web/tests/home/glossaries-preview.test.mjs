import test from "node:test";
import assert from "node:assert/strict";
import * as importer from "../../src/features/glossaries/domain/glossary-import.js";

test("preview detects semicolons and TSV with embedded commas and quoted newlines", () => {
  for (const text of ['source;target;note\n"a,b";甲;"one\ntwo"', 'source\ttarget\tnote\n"a,b"\t甲\t"one\ntwo"']) {
    const table = importer.parseGlossaryTable(text);
    const preview = importer.previewGlossaryImport(table);
    assert.equal(preview.entries[0].source, "a,b");
    assert.equal(preview.entries[0].note, "one\ntwo");
    assert.deepEqual(preview.errors, []);
  }
});

test("custom mapping preserves context and quotes, detects duplicates, and reports missing cells", () => {
  const table = importer.parseGlossaryTable('Chinese,English,Domain\n甲,"a,b",science\n乙,"a,b",science\n丙,,science');
  const preview = importer.previewGlossaryImport(table, { hasHeader: true, columns: { source: 1, target: 0, context: 2 } });
  assert.equal(preview.entries[0].target, "甲");
  assert.equal(preview.entries[0].context, "science");
  assert.equal(preview.duplicateCount, 1);
  assert.match(preview.errors.join(" "), /4/);
  assert.match(preview.csv, /"a,b"/);
});

test("preview refuses malformed quotes and duplicate column mappings", () => {
  assert.throws(() => importer.parseGlossaryTable('source,target\n"unclosed,译文'), /引号|CSV/);
  const table = importer.parseGlossaryTable('a,b\nc,d');
  const preview = importer.previewGlossaryImport(table, { hasHeader: false, columns: { source: 0, target: 0 } });
  assert.ok(preview.errors.length);
});

test("headerless imports keep the first row; preserve terms allow empty targets", () => {
  const table = importer.parseGlossaryTable('DNA,,preserve\ncat,猫,preferred');
  const preview = importer.previewGlossaryImport(table, { hasHeader: false, columns: { source: 0, target: 1, level: 2 } });
  assert.equal(preview.entries.length, 2);
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.entries[0].source, "DNA");
});

test("a 458-term glossary imports intact and more than 1000 distinct entries are rejected", () => {
  const csv = "source,target\n" + Array.from({ length: 458 }, (_, i) => `term${i},译文${i}`).join("\n");
  const preview = importer.previewGlossaryImport(importer.parseGlossaryTable(csv));
  assert.deepEqual(preview.errors, []);
  assert.equal(importer.mergeGlossaryEntries([], preview.entries, "replace").entries.length, 458);
  const oversized = "source,target\n" + Array.from({ length: 1001 }, (_, i) => `term${i},译文`).join("\n");
  assert.match(importer.previewGlossaryImport(importer.parseGlossaryTable(oversized)).errors.join(" "), /1000/);
});
