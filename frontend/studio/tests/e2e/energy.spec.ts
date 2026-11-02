import { expect, test } from '@playwright/test';

import { appendToFixture, editor, openStudio, resetFixture, savedMarkdown, saveStatus } from './studio.ts';

// Reaction energy profiles (```energy, plugins/energy): a species a line, drawn as the blog draws them, redrawn as they change.

test.beforeEach(() => resetFixture());

test('能量图 from the slash menu draws its diagram, redrawn as a path is added; saved as a fence', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/能量图');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label')).toHaveText(['能量图']);
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');

	const block = editor(page).locator('.milkdown-code-block', { has: page.locator('.note-energy') });
	const plot = block.locator('svg.note-energy-plot');
	await expect(plot.locator('.energy-level')).toHaveCount(5);
	await expect(plot.locator('.energy-value')).toHaveText(['0', '12.3', '−4.1', '8.0', '−15.2']);
	await expect(plot.locator('.energy-axis-name')).toHaveText('ΔG / kcal·mol⁻¹');

	// Another path: the species it shares stand where they are; a line that is no species is told under the diagram.
	await block.hover();
	await block.locator('.preview-toggle-button').click();
	await block.locator('.cm-content').click();
	await page.keyboard.press('ControlOrMeta+End');
	await page.keyboard.type('\n# 协同\n反应物 0\nTS 18.5\n产物 -15.2\n过渡态');
	await expect(plot.locator('.energy-level')).toHaveCount(6);
	await expect(plot.locator('.energy-legend')).toHaveText(['路径 1', '协同']);
	await expect(block.locator('.note-energy-problems')).toHaveText('第 11 行：读不出「过渡态」：要写成「名字 能量」，比如「TS1 12.3」');
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Backspace');
	await expect(block.locator('.note-energy-problems')).toHaveCount(0);

	await page.waitForTimeout(300);
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('结尾段落。\n\n```energy\ny: ΔG / kcal·mol⁻¹\n反应物 0\nTS1 12.3\n中间体 -4.1\nTS2 8.0\n产物 -15.2\n# 协同\n反应物 0\nTS 18.5\n产物 -15.2\n```\n');
});

test('an article’s diagram is drawn when it is opened, its paths told apart', async ({ page }) => {
	appendToFixture('\n```energy\ntitle: SN2\n# 气相\nCl⁻ + CH₃Br 0\nTS 3.1\nCH₃Cl + Br⁻ -14.8\n# 水中\nCl⁻ + CH₃Br 0\nTS 26.4\nCH₃Cl + Br⁻ -8.9\n```\n');
	await openStudio(page);
	const plot = editor(page).locator('svg.note-energy-plot');
	await expect(plot).toHaveAttribute('aria-label', 'SN2');
	await expect(plot.locator('.energy-level.energy-path-0')).toHaveCount(3);
	// The start is the same species at the same energy: drawn once.
	await expect(plot.locator('.energy-level.energy-path-1')).toHaveCount(2);
	await expect(plot.locator('.energy-link.energy-path-1')).toHaveCount(2 + 1);
	// The same names in both, in water at other energies: no mistake, and each name said once in its column.
	await expect(plot.locator('.energy-name')).toHaveText(['Cl⁻ + CH₃Br', 'TS', 'CH₃Cl + Br⁻']);
	await expect(editor(page).locator('.note-energy-problems')).toHaveCount(0);
	await expect(editor(page).locator('.note-energy figcaption')).toHaveText('SN2');
});
