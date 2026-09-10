import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNotesMarkdown,
  groupNotesByPage,
  notesStorageKey,
  sortNotes,
} from "../../../../frontend/packages/reader/src/annotations/types.ts";

test("notesStorageKey prefers job id", () => {
  assert.equal(notesStorageKey({ jobId: "j1", documentId: "d1" }), "retainpdf.reader.notes.v1:job:j1");
  assert.equal(notesStorageKey({ documentId: "d1" }), "retainpdf.reader.notes.v1:doc:d1");
});

test("sortNotes by page then createdAt", () => {
  const list = sortNotes([
    { id: "b", page: 2, pane: "source", quote: "b", note: "", createdAt: "2020-01-02" },
    { id: "a", page: 1, pane: "source", quote: "a", note: "", createdAt: "2020-01-03" },
    { id: "c", page: 2, pane: "source", quote: "c", note: "", createdAt: "2020-01-01" },
  ]);
  assert.deepEqual(list.map((x) => x.id), ["a", "c", "b"]);
});

test("groupNotesByPage", () => {
  const groups = groupNotesByPage([
    { id: "1", page: 1, pane: "source", quote: "x", note: "", createdAt: "a" },
    { id: "2", page: 1, pane: "source", quote: "y", note: "", createdAt: "b" },
    { id: "3", page: 3, pane: "translated", quote: "z", note: "n", createdAt: "c" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].page, 1);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].page, 3);
});

test("buildNotesMarkdown exports quotes and notes", () => {
  const md = buildNotesMarkdown("Demo", [
    { id: "1", page: 2, pane: "source", quote: "hello", note: "world", createdAt: "t" },
  ]);
  assert.match(md, /# Demo · 批注/);
  assert.match(md, /## 第 2 页/);
  assert.match(md, /> hello/);
  assert.match(md, /笔记：world/);
});
