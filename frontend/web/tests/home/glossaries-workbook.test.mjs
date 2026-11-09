import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../..", import.meta.url));
const bundle = build({
  absWorkingDir: root, bundle: true, write: false, format: "iife", jsx: "automatic",
  stdin: { resolveDir: root, loader: "tsx", contents: `
    import { useState } from "react";
    import { createRoot } from "react-dom/client";
    import { GlossaryImportPanel } from "./src/features/glossaries/ui/GlossaryImportPanel.tsx";
    function Harness() {
      const [text, setText] = useState("");
      return <GlossaryImportPanel visible csvText={text} onCsvTextChange={setText}
        onApply={(mode, csv) => { window.applied = { mode, csv }; }} onCancel={() => {}} />;
    }
    createRoot(document.getElementById("app")).render(<Harness />);
  ` },
});

async function mount(t) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent('<div id="app"></div>');
  await page.addScriptTag({ content: (await bundle).outputFiles[0].text });
  await page.locator('#glossary-import-file').waitFor();
  return page;
}

test("Excel workbook imports the selected sheet, preserving leading zeros and multiline context", async t => {
  const page = await mount(t);
  await page.locator('#glossary-import-file').setInputFiles(fileURLToPath(new URL('../fixtures/glossaries/multi-sheet.xlsx', import.meta.url)));
  await page.getByRole('table', { name: '导入词条预览' }).waitFor();
  assert.match(await page.getByRole('table').innerText(), /cat/);
  await page.getByLabel('工作表', { exact: true }).selectOption('1');
  assert.match(await page.getByRole('table').innerText(), /00123/);
  assert.equal(await page.getByLabel('原词列', { exact: true }).inputValue(), '1');
  await page.locator('#glossary-import-apply-btn').click();
  const applied = await page.evaluate(() => window.applied);
  assert.equal(applied.mode, 'append');
  assert.equal(applied.csv, 'source,target,note,level,match_mode,context\r\n00123,编号,,,,identifier\r\n"a,b",逗号,,,,"one\ntwo"');
});

test("manual column mapping controls imported fields and invalid Excel cannot apply stale content", async t => {
  const page = await mount(t);
  await page.locator('#glossary-csv-text').fill('Chinese;English;Domain\n猫;cat;biology');
  await page.getByLabel('首行为表头').check();
  await page.getByLabel('原词列', { exact: true }).selectOption('1');
  await page.getByLabel('译文列', { exact: true }).selectOption('0');
  await page.getByLabel('备注列', { exact: true }).selectOption('-1');
  await page.getByLabel('语境列', { exact: true }).selectOption('2');
  await page.locator('#glossary-import-apply-btn').click();
  assert.equal((await page.evaluate(() => window.applied)).csv, 'source,target,note,level,match_mode,context\r\ncat,猫,,,,biology');
  await page.locator('#glossary-import-file').setInputFiles({ name: 'broken.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('broken') });
  await page.getByRole('alert').filter({ hasText: '无法读取 Excel' }).waitFor();
  assert.equal(await page.locator('#glossary-import-apply-btn').isDisabled(), true);
});

if (process.env.GLOSSARY_IMPORT_SMOKE_FILE) {
  test("local CSV is accepted by the real browser file picker and mapping preview", async t => {
    const page = await mount(t);
    await page.locator('#glossary-import-file').setInputFiles(process.env.GLOSSARY_IMPORT_SMOKE_FILE);
    await page.getByRole('table', { name: '导入词条预览' }).waitFor();
    assert.equal(await page.getByRole('alert').count(), 0);
    await page.locator('#glossary-import-apply-btn').click();
    const applied = await page.evaluate(() => window.applied);
    assert.ok(applied.csv.includes('source,target,note,level,match_mode,context'));
    console.log(await page.locator('.glossary-import-preview [role="status"]').innerText());
  });
}
