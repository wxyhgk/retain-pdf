import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { GlossaryImportPanel } from "../../src/features/glossaries/ui/GlossaryImportPanel.jsx";
import { GlossaryEditor } from "../../src/features/glossaries/ui/GlossaryEditor.jsx";

test("long import panels scroll without overlapping entry rows at desktop and mobile widths", async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    const css = readFileSync(new URL("../../dist/css/home.css", import.meta.url), "utf8");
    const panel = renderToStaticMarkup(createElement(GlossaryImportPanel, { visible: true, csvText: "cat,猫", onCsvTextChange() {}, onApply() {}, onCancel() {} }));
    const editor = renderToStaticMarkup(createElement(GlossaryEditor, { entries: [{ source: "cat", target: "猫", note: "", level: "preferred", match_mode: "exact", context: "" }], structureRevision: 0, onFieldChange() {}, onRemoveRow() {} }));
    const page = await browser.newPage();
    for (const width of [500, 300]) {
      await page.setViewportSize({ width: width + 40, height: 500 });
      await page.setContent(`<style>${css}</style><div class="glossary-editor-scroll" style="width:${width}px;height:240px;margin:20px">${panel}${editor}</div>`);
      const panelBox = await page.locator('#glossary-import-panel').boundingBox();
      const applyBox = await page.locator('#glossary-import-apply-btn').boundingBox();
      const tableBox = await page.locator('.glossary-table-wrap').boundingBox();
      assert.ok(applyBox.y + applyBox.height <= panelBox.y + panelBox.height, `import actions overflow at ${width}px`);
      assert.ok(tableBox.y >= panelBox.y + panelBox.height, `entries overlap import at ${width}px`);
      await page.locator('#glossary-import-apply-btn').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('#glossary-import-apply-btn').evaluate(button => {
        const r = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), true, `import button is clickable at ${width}px`);
    }
  } finally { await browser.close(); }
});
