import { expect, test, type Locator, type Page } from '@playwright/test';

import { appendToFixture, editor, fixtureHas, openStudio, resetFixture, saveStatus, savedMarkdown, writeFixtureFile } from './studio.ts';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');

const fileRow = (page: Page, path: string): Locator => page.locator(`#file-tree .file-row[data-path="${path}"]`);
const status = (page: Page): Locator => page.locator('#files-status');

async function menu(page: Page, path: string, item: string): Promise<void> {
	await fileRow(page, path).click({ button: 'right' });
	await page.getByRole('menuitem', { name: item }).click();
}

async function rename(page: Page, path: string, name: string): Promise<void> {
	await menu(page, path, '重命名');
	const input = page.locator('.file-name-input');
	await input.fill(name);
	await input.press('Enter');
}

test.beforeEach(() => resetFixture());

test('the panel lists the article, with folders git has not kept', async ({ page }) => {
	await openStudio(page);
	await expect(page.locator('#files-root')).toHaveText('blog/studio-fixture/');
	await expect(page.locator('#file-tree .file-row .file-name')).toHaveText(['index.md', 'img', 'assets', 'ai', 'article.config.yaml', 'article.views.json']);
});

test('an upload lands by kind, and a file the article does not use is dimmed', async ({ page }) => {
	await openStudio(page);
	await page.locator('#file-upload-input').setInputFiles([
		{ name: 'Screen Shot 1.png', mimeType: 'image/png', buffer: PNG },
		{ name: 'water.xyz', mimeType: 'text/plain', buffer: Buffer.from('3\nwater\nO 0 0 0\nH 0.76 0.5 0\nH -0.76 0.5 0\n') },
	]);
	await expect(status(page)).toHaveText('已上传 2 个文件');
	await expect(fileRow(page, 'img/Screen-Shot-1.png')).toHaveClass(/is-unused/);
	await expect(fileRow(page, 'assets/water.xyz')).toHaveClass(/is-unused/);
	expect(fixtureHas('img/Screen-Shot-1.png')).toBe(true);
});

test('files dropped from the desktop go into the folder they are dropped on', async ({ page }) => {
	writeFixtureFile('assets/runs/.keep', '');
	await openStudio(page);
	await fileRow(page, 'assets/runs').waitFor();
	await page.evaluate(() => {
		const transfer = new DataTransfer();
		transfer.items.add(new File(['log'], 'out.log', { type: 'text/plain' }));
		const target = document.querySelector('#file-tree .file-row[data-path="assets/runs"]')!;
		target.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
		target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
	});
	await expect(fileRow(page, 'assets/runs/out.log')).toBeVisible();
	expect(fixtureHas('assets/runs/out.log')).toBe(true);
});

test('renaming a file the article uses rewrites its references', async ({ page }) => {
	writeFixtureFile('img/plot.png', PNG);
	appendToFixture('\n![图](./img/plot.png)\n');
	await openStudio(page);
	await expect(fileRow(page, 'img/plot.png')).not.toHaveClass(/is-unused/);

	await rename(page, 'img/plot.png', 'figure.png');
	await expect(status(page)).toHaveText('已移动到 img/figure.png，正文里 1 处引用已同步修改');
	expect(savedMarkdown()).toContain('![图](./img/figure.png)');
	expect(fixtureHas('img/plot.png')).toBe(false);
	await expect(saveStatus(page)).toHaveText('已载入');
	await expect(fileRow(page, 'img/figure.png')).toHaveClass(/is-selected/);
});

test('unsaved edits survive a rename and follow it', async ({ page }) => {
	writeFixtureFile('img/plot.png', PNG);
	appendToFixture('\n![图](./img/plot.png)\n');
	await openStudio(page);
	await editor(page).getByText('开头段落').click();
	await page.keyboard.press('End');
	await page.keyboard.type('未保存的字');
	await expect(saveStatus(page)).toHaveText('未保存');

	await rename(page, 'img/plot.png', 'figure.png');
	await expect(status(page)).toContainText('1 处引用已同步修改');
	// On disk: the reference follows, the edit is not saved behind the author's back.
	expect(savedMarkdown()).toContain('![图](./img/figure.png)');
	expect(savedMarkdown()).not.toContain('未保存的字');
	await expect(saveStatus(page)).toHaveText('未保存');
	await expect(editor(page)).toContainText('未保存的字');

	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('未保存的字');
	expect(savedMarkdown()).toContain('![图](./img/figure.png)');
});

test('a file dragged onto a folder moves there', async ({ page }) => {
	writeFixtureFile('assets/water.xyz', '3\nwater\n');
	writeFixtureFile('assets/frames/.keep', '');
	await openStudio(page);
	await fileRow(page, 'assets/water.xyz').dragTo(fileRow(page, 'assets/frames'));
	await expect(fileRow(page, 'assets/frames/water.xyz')).toBeVisible();
	expect(fixtureHas('assets/water.xyz')).toBe(false);
});

test('new folders are named in place', async ({ page }) => {
	await openStudio(page);
	await fileRow(page, 'assets').click();
	await page.locator('#new-folder').click();
	await page.locator('.file-name-input').fill('orbitals');
	await page.locator('.file-name-input').press('Enter');
	await expect(fileRow(page, 'assets/orbitals')).toBeVisible();
	expect(fixtureHas('assets/orbitals')).toBe(true);
});

test('removing a file the article uses warns first, and the file goes to the trash', async ({ page }) => {
	writeFixtureFile('img/plot.png', PNG);
	appendToFixture('\n![图](./img/plot.png)\n');
	await openStudio(page);

	const messages: string[] = [];
	page.once('dialog', (dialog) => { messages.push(dialog.message()); void dialog.dismiss(); });
	await fileRow(page, 'img/plot.png').click();
	await page.keyboard.press('Delete');
	await expect.poll(() => messages.length).toBe(1);
	expect(messages[0]).toContain('正文里有 1 处引用它');
	expect(fixtureHas('img/plot.png')).toBe(true);

	page.once('dialog', (dialog) => void dialog.accept());
	await menu(page, 'img/plot.png', '移到回收站');
	await expect(fileRow(page, 'img/plot.png')).toHaveCount(0);
	expect(fixtureHas('img/plot.png')).toBe(false);
});

test('the article’s own files and folders cannot be renamed or removed', async ({ page }) => {
	await openStudio(page);
	await fileRow(page, 'index.md').click({ button: 'right' });
	await expect(page.getByRole('menuitem')).toHaveText(['复制路径', /^在 ?(Finder|文件管理器) ?中显示$/]);
	await page.keyboard.press('Escape');
	await fileRow(page, 'img').click({ button: 'right' });
	await expect(page.getByRole('menuitem', { name: '重命名' })).toHaveCount(0);
	await expect(page.getByRole('menuitem', { name: '移到回收站' })).toHaveCount(0);
});

test('images open as written, load from the article folder, and are saved unchanged', async ({ page }) => {
	writeFixtureFile('img/plot.png', PNG);
	appendToFixture('\n![图](./img/plot.png)\n\n段落二 ![行内](./img/plot.png "标题") 结束\n');
	await openStudio(page);
	await expect(page.locator('#roundtrip-status')).toHaveText('Markdown 完整保留');
	const loaded = editor(page).locator('img[src="/api/studio/articles/studio-fixture/files/img/plot.png"]');
	await expect(loaded).toHaveCount(2);
	await expect.poll(() => loaded.first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);

	await editor(page).getByText('结尾段落。').click();
	await page.keyboard.press('End');
	await page.keyboard.type('字');
	await expect(saveStatus(page)).toHaveText('未保存');
	await page.keyboard.press('ControlOrMeta+Enter');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('结尾段落。字\n\n![图](./img/plot.png)\n\n段落二 ![行内](./img/plot.png "标题") 结束\n');
});
