import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, fixtureHas, openStudio, resetFixture, savedMarkdown, saveStatus, writeFixtureFile } from './studio.ts';

// Calculation results (```qc, plugins/qc): a Gaussian or ORCA output of the article as a card, its details in a sheet.

const OUTPUTS = new URL('../../packages/compute/test/fixtures/qc/', import.meta.url);
const output = (name: string) => readFileSync(new URL(name, OUTPUTS));

test.beforeEach(() => resetFixture());

const card = (page: Page) => editor(page).locator('.qc-block .job-card');
const sheet = (page: Page) => page.locator('.block-sheet');

async function save(page: Page): Promise<string> {
	await page.waitForTimeout(500);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	return savedMarkdown();
}

/** Drops these files on the end of the last paragraph. */
async function drop(page: Page, files: Array<{ name: string; text: string }>): Promise<void> {
	const text = editor(page).getByText('结尾段落。', { exact: true });
	await text.scrollIntoViewIfNeeded();
	const box = (await text.boundingBox())!;
	await page.evaluate(({ files, x, y }) => {
		const transfer = new DataTransfer();
		for (const file of files) transfer.items.add(new File([file.text], file.name, { type: 'text/plain' }));
		document.elementFromPoint(x, y)!.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, clientX: x, clientY: y, bubbles: true, cancelable: true }));
	}, { files, x: box.x + box.width - 2, y: box.y + box.height / 2 });
}

test('a Gaussian output dropped in becomes its card; another .log stays output', async ({ page }) => {
	await openStudio(page);
	await drop(page, [{ name: 'co2.log', text: output('co2-g16.log').toString('utf8') }]);
	await expect(card(page).locator('.job-kind')).toHaveText('Gaussian 16');
	await expect(card(page).locator('.job-card-line')).toHaveText('E −188.443037 Eh  ·  G −188.451964 Eh  ·  无虚频');
	await expect(card(page).locator('.job-card-describe')).toHaveText('B3LYP/def2SVP · 优化＋频率 · CO₂ · 电荷 0 · 单重态');
	await expect(card(page).locator('.job-card-picture svg')).toBeVisible();
	expect(fixtureHas('assets/co2.log')).toBe(true);
	expect(await save(page)).toContain('```qc\n@file ./assets/co2.log\n```');

	await drop(page, [{ name: 'run.log', text: 'step 1 ok\nstep 2 ok\n' }]);
	await expect(page.locator('.studio-toast')).toContainText('run.log');
	expect(await save(page)).toContain('```output\n@file ./assets/run.log\n```');
});

test('a double click opens what it found: numbers, the vibrations and IR spectrum, the output; 设置 retitles it', async ({ page }) => {
	writeFixtureFile('assets/hcn-ts.out', output('hcn-ts-orca.out'));
	appendToFixture('\n```qc\n@file ./assets/hcn-ts.out\n```\n');
	await openStudio(page);
	await expect(card(page).locator('.job-kind')).toHaveText('ORCA 6.0.1');
	await expect(card(page).locator('.job-card-line')).toContainText('1 个虚频（−1121.8 cm⁻¹）');
	await card(page).dblclick();
	await expect(sheet(page)).toBeVisible();
	await expect(sheet(page).locator('.job-number', { hasText: '自由能 G' }).locator('dd')).toHaveText('−93.234545 Eh');
	await expect(sheet(page).locator('.job-section-title', { hasText: '优化过程' })).toContainText('2 步，已收敛');
	await expect(sheet(page).locator('.job-modes li')).toHaveCount(3);
	await expect(sheet(page).locator('.job-modes li.is-imaginary')).toHaveCount(1);
	// The imaginary mode vibrating, its arrows the page's gray: nothing red in HCN (red says something went wrong).
	await sheet(page).locator('.job-modes li.is-imaginary button').click();
	const redPixels = () =>
		sheet(page).locator('.job-vibration-view canvas').evaluate((canvas: HTMLCanvasElement) => {
			const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
			let count = 0;
			for (let at = 0; at < data.length; at += 4) if (data[at] > 150 && data[at] - data[at + 1] > 90 && data[at] - data[at + 2] > 90) count += 1;
			return count;
		});
	await page.waitForTimeout(400);
	expect(await redPixels()).toBeLessThan(5);
	await sheet(page).getByRole('tab', { name: '输出' }).click();
	await expect(sheet(page).locator('.qc-output')).toContainText('ORCA TERMINATED NORMALLY');
	await sheet(page).getByRole('tab', { name: '设置' }).click();
	await sheet(page).getByLabel('标题').fill('HCN ⇌ HNC 的过渡态');
	await sheet(page).getByLabel('标题').press('Enter');
	await sheet(page).getByLabel('标题').blur();
	await page.keyboard.press('Escape');
	await expect(card(page).locator('.job-card-title')).toHaveText('HCN ⇌ HNC 的过渡态');
	expect(await save(page)).toContain('```qc\n@file ./assets/hcn-ts.out\ntitle: HCN ⇌ HNC 的过渡态\n```');
});

test('计算结果 from the slash menu takes an output chosen; one that did not end well says so', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/计算结果');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('计算结果');
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	const chooser = page.waitForEvent('filechooser');
	await editor(page).locator('.qc-block-empty').getByRole('button', { name: '选择输出文件…' }).click();
	await (await chooser).setFiles({ name: 'stopped.log', mimeType: 'text/plain', buffer: output('co2-maxcycles-g16.log') });
	await expect(card(page).locator('.job-state')).toHaveText('没收敛');
	await expect(card(page).locator('.job-card-line')).toHaveText('优化没有收敛（走了 2 步就停了）');
	expect(await save(page)).toContain('```qc\n@file ./assets/stopped.log\n```');
});
