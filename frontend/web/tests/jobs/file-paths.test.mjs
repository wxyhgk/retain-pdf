// 文件出口的地址只在 @retainpdf/domain/job 的 file-paths 里拼（原文 PDF 以前 5 处、译文 PDF 3 处各拼一遍）。
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { documentSourcePdfPath, jobOutputFilePath } from "@retainpdf/domain/job";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("原文 PDF：编号转义；给了版本才带 version", () => {
  assert.equal(documentSourcePdfPath("doc/1"), "/api/v1/documents/doc%2F1/files/source.pdf");
  assert.equal(documentSourcePdfPath(" doc-1 ", " v 2 "), "/api/v1/documents/doc-1/files/source.pdf?version=v%202");
  assert.equal(documentSourcePdfPath("doc-1", ""), "/api/v1/documents/doc-1/files/source.pdf");
});

test("任务成品：编号转义；download 才带 ?download=1", () => {
  assert.equal(jobOutputFilePath("job 1", "translated.pdf"), "/api/v1/jobs/job%201/files/output/translated.pdf");
  assert.equal(
    jobOutputFilePath("job-1", "side-by-side.pdf", { download: true }),
    "/api/v1/jobs/job-1/files/output/side-by-side.pdf?download=1",
  );
  assert.equal(jobOutputFilePath("job-1", "ocr.md"), "/api/v1/jobs/job-1/files/output/ocr.md");
});

test("别处不再手拼这几个文件的地址", () => {
  // 只认模板字符串里拼出来的地址；注释、mock:// 夹具、按后端给的链接推算的不算。
  const pattern = /`[^`]*\/files\/(source\.pdf|output\/(translated\.pdf|side-by-side\.pdf|ocr\.md))/;
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["dist", "node_modules", "generated"].includes(entry.name)) walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !full.endsWith("file-paths.ts")) {
        readFileSync(full, "utf8").split("\n").forEach((line, index) => {
          if (!/^\s*(\/\/|\/?\*)/.test(line) && pattern.test(line)) offenders.push(`${full.slice(frontendRoot.length + 1)}:${index + 1}`);
        });
      }
    }
  };
  for (const root of ["web/src", "packages/api/src", "packages/domain/src", "packages/reader/src"]) {
    walk(resolve(frontendRoot, root));
  }
  assert.deepEqual(offenders, [], "改用 documentSourcePdfPath / jobOutputFilePath");
});
