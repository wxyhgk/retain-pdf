import { expect, test, type Page } from '@playwright/test';

import { caretAfter, editor, fixtureHas, openStudio, resetFixture, saveStatus, savedMarkdown, scienceBlock, writeFixtureFile } from './studio.ts';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');
const XYZ = '3\nwater\nO 0 0 0.1173\nH 0 0.7572 -0.4692\nH 0 -0.7572 -0.4692\n';

/** Drop files from the desktop (or a row from the file panel) onto the editor text `target`. */
async function drop(page: Page, target: string, files: Array<{ name: string; type: string; base64: string }>, panelPath?: string): Promise<void> {
	const text = editor(page).getByText(target, { exact: true });
	await text.scrollIntoViewIfNeeded();
	const box = (await text.boundingBox())!;
	await page.evaluate(({ files, panelPath, x, y }) => {
		const transfer = new DataTransfer();
		for (const file of files) {
			const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
			transfer.items.add(new File([bytes], file.name, { type: file.type }));
		}
		if (panelPath) transfer.setData('application/x-studio-file', panelPath);
		const target = document.elementFromPoint(x, y)!;
		target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, clientX: x, clientY: y, bubbles: true, cancelable: true }));
	}, { files, panelPath, x: box.x + box.width - 2, y: box.y + box.height / 2 });
}

async function save(page: Page): Promise<string> {
	await expect(saveStatus(page)).toHaveText('未保存');
	// The editor reports a change after a short pause; an insertion right after typing must be in before saving.
	await page.waitForTimeout(500);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

test.beforeEach(() => resetFixture());

test('a picture pasted into the editor is uploaded to img/ and inserted after the paragraph', async ({ page }) => {
	await openStudio(page);
	await caretAfter(page, '结尾段落。');
	await page.evaluate((base64) => {
		const clipboard = new DataTransfer();
		clipboard.items.add(new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], 'Screen Shot 1.png', { type: 'image/png' }));
		document.querySelector('.milkdown .ProseMirror')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
	}, PNG.toString('base64'));
	const image = editor(page).locator('img[src="/api/studio/articles/studio-fixture/files/img/Screen-Shot-1.png"]');
	await expect(image).toBeVisible();
	expect(fixtureHas('img/Screen-Shot-1.png')).toBe(true);
	await expect(page.locator('#file-tree .file-row[data-path="img/Screen-Shot-1.png"]')).toBeVisible();
	expect(await save(page)).toContain('结尾段落。\n\n![Screen-Shot-1](./img/Screen-Shot-1.png)\n');
});

test('a structure file dropped on the editor becomes an @file chemistry block', async ({ page }) => {
	await openStudio(page);
	await drop(page, '结尾段落。', [{ name: 'water.xyz', type: 'chemical/x-xyz', base64: Buffer.from(XYZ).toString('base64') }]);
	await expect(scienceBlock(page, 'XYZ')).toHaveCount(2);
	expect(fixtureHas('assets/water.xyz')).toBe(true);
	expect(await save(page)).toContain('结尾段落。\n\n```xyz\n@file ./assets/water.xyz\n```\n');
});

test('a file dragged from the panel is inserted without uploading again', async ({ page }) => {
	writeFixtureFile('assets/run.log', 'done');
	await openStudio(page);
	await drop(page, '结尾段落。', [], 'assets/run.log');
	await expect(editor(page).getByRole('link', { name: 'run.log' })).toBeVisible();
	const saved = await save(page);
	expect(saved).toContain('结尾段落。\n\n[run.log](./assets/run.log)\n');
	await expect(page.locator('#file-tree .file-row[data-path="assets/run.log"]')).not.toHaveClass(/is-unused/);
});

test('the slash menu’s 图片 uploads the chosen picture into the article', async ({ page }) => {
	await openStudio(page);
	await caretAfter(page, '结尾段落。');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/图片');
	const chooser = page.waitForEvent('filechooser');
	await page.locator('.milkdown-slash-menu').getByText('图片', { exact: true }).click();
	await (await chooser).setFiles({ name: 'plot.png', mimeType: 'image/png', buffer: PNG });
	await expect(editor(page).locator('img[src$="/files/img/plot.png"]')).toBeVisible();
	expect(await save(page)).toContain('结尾段落。\n\n![plot](./img/plot.png)\n');
});
