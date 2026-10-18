import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { driveHas, editor, fixtureHas, openStudio, resetDrive, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// The drive (资料库): a folder of the author's, browsed in the Studio, its files previewed and copied into articles.

const fixture = (name: string) => readFileSync(new URL(`./fixtures/office/${name}`, import.meta.url));
const page_ = (page: Page): Locator => page.locator('#drive-view');
const pane = (page: Page): Locator => page.locator('#side-drive');
const row = (where: Locator, path: string): Locator => where.locator(`.drive-row[data-path="${path}"]`);
const status = (where: Locator): Locator => where.locator('.drive-status');

test.beforeEach(async ({ page }) => {
	resetFixture();
	resetDrive({
		'组会/第 3 次组会 (定稿).pptx': fixture('slides.pptx'),
		'组会/2026 秋/优化报告.docx': fixture('report.docx'),
		'计算输出/water opt.log': ' SCF Done:  E(RB3LYP) =  -76.4089 A.U.\n',
	});
	await openStudio(page);
});

test('the drive is a page of its own: folders opened, crumbs back, the article kept behind it', async ({ page }) => {
	await page.locator('#open-drive').click();
	await expect(page.locator('.crepe-host')).toBeHidden();
	await expect(page_(page).locator('.drive-row:not(.drive-head) .drive-name')).toHaveText(['计算输出', '组会']);
	await row(page_(page), '组会').dblclick();
	await expect(page_(page).locator('.drive-row:not(.drive-head) .drive-name')).toHaveText(['2026 秋', '第 3 次组会 (定稿).pptx']);
	await expect(page).toHaveURL(/drive=%E7%BB%84%E4%BC%9A/u);
	await expect(row(page_(page), '组会/第 3 次组会 (定稿).pptx').locator('.drive-size')).toHaveText(/KB$/u);

	// A file opens in the page's viewer.
	await row(page_(page), '组会/第 3 次组会 (定稿).pptx').dblclick();
	await expect(page.locator('.office-viewer-body')).toContainText('水分子几何优化');
	await page.keyboard.press('Escape');

	await page_(page).locator('.drive-crumb').first().click();
	await expect(row(page_(page), '计算输出')).toBeVisible();

	// Back to the article from the sidebar.
	await page.locator('#article-list').getByText('Studio 测试夹具').click();
	await expect(page.locator('.crepe-host')).toBeVisible();
	await expect(page_(page)).toBeHidden();
	await expect(page).not.toHaveURL(/drive=/u);
});

test('uploads, a new folder named, a file moved into it, trashed and put back', async ({ page }) => {
	await page.locator('#open-drive').click();
	const list = page_(page).locator('.drive-list');
	await expect(row(page_(page), '组会')).toBeVisible();

	// A file dropped in from the desktop.
	await list.evaluate((target) => {
		const transfer = new DataTransfer();
		transfer.items.add(new File(['C 0 0 0\n'], 'methane draft.xyz', { type: 'chemical/x-xyz' }));
		target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
	});
	await expect(status(page_(page))).toHaveText('已上传 methane draft.xyz');
	expect(driveHas('methane draft.xyz')).toBe(true);

	await page_(page).getByRole('button', { name: '新建文件夹' }).click();
	const name = page_(page).locator('.drive-name-input');
	await expect(name).toHaveValue('新建文件夹');
	await name.fill('草稿 (旧)');
	await name.press('Enter');
	await expect(row(page_(page), '草稿 (旧)')).toBeVisible();

	await row(page_(page), 'methane draft.xyz').dragTo(row(page_(page), '草稿 (旧)'));
	await expect(row(page_(page), 'methane draft.xyz')).toHaveCount(0);
	expect(driveHas('草稿 (旧)/methane draft.xyz')).toBe(true);
	// The side panel's list shows it too.
	await page.locator('#side-tab-drive').click();
	await expect(row(pane(page), '草稿 (旧)')).toBeVisible();

	await row(page_(page), '草稿 (旧)').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '移到回收站' }).click();
	await expect(row(page_(page), '草稿 (旧)')).toHaveCount(0);
	expect(driveHas('草稿 (旧)')).toBe(false);
	await page.locator('.studio-toast').getByRole('button', { name: '撤销' }).click();
	await expect(row(page_(page), '草稿 (旧)')).toBeVisible();
	expect(driveHas('草稿 (旧)/methane draft.xyz')).toBe(true);
});

test('a file of the drive goes into the article as a copy: from the menu, and dragged from the side panel', async ({ page }) => {
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');

	await page.locator('#open-drive').click();
	await row(page_(page), '计算输出').dblclick();
	await row(page_(page), '计算输出/water opt.log').click({ button: 'right' });
	await page.getByRole('menuitem', { name: '插入到《Studio 测试夹具》' }).click();
	await expect(status(page_(page))).toHaveText('已复制到文章并插入：water opt.log');
	expect(fixtureHas('assets/water-opt.log')).toBe(true);

	await page.locator('#article-list').getByText('Studio 测试夹具').click();
	await expect(editor(page).locator('.code-file-figure, figure', { hasText: 'SCF Done' }).first()).toBeVisible();

	await page.locator('#side-tab-drive').click();
	await row(pane(page), '组会').dblclick();
	const target = editor(page).locator('p', { hasText: '结尾段落' });
	await target.scrollIntoViewIfNeeded();
	const box = (await target.boundingBox())!;
	await page.evaluate(({ x, y }) => {
		const transfer = new DataTransfer();
		transfer.setData('application/x-studio-drive', '组会/第 3 次组会 (定稿).pptx');
		document.elementFromPoint(x, y)!.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, clientX: x, clientY: y, bubbles: true, cancelable: true }));
	}, { x: box.x + box.width - 2, y: box.y + box.height / 2 });
	await expect(editor(page).locator('.office-card .office-card-name')).toHaveText('第-3-次组会-定稿.pptx');
	expect(fixtureHas('assets/第-3-次组会-定稿.pptx')).toBe(true);
	await page.waitForTimeout(500);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('[第-3-次组会-定稿.pptx](./assets/第-3-次组会-定稿.pptx)');
	expect(savedMarkdown()).toContain('@file ./assets/water-opt.log');
});
