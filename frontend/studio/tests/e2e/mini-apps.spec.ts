import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { editor, openStudio, resetFixture, saveStatus, savedMarkdown, slug, writeFixtureFile } from './studio.ts';

// 小程序: the tools of apps/ (two to begin with: energy-units, gaussian-input), each in a floating window, in a frame
// that reaches the Studio only through `studio`, and only for what its app.json asks.

/** The apps/ of the server's own copy of the repository (E2E_ISOLATED). */
const apps = () => join(process.env.E2E_ROOT_PARENT!, basename(fileURLToPath(new URL('../..', import.meta.url))), 'apps');

async function openApp(page: Page, name: string): Promise<void> {
	await page.locator('#open-apps').click();
	await page.getByRole('menuitem', { name }).click();
}

const appFrame = (page: Page, id: string) => page.frameLocator(`.mini-app-window[data-app="${id}"] iframe`);

test.beforeEach(() => resetFixture());

test('能量单位换算 opens floating, converts, and puts a value into the article where the caret is', async ({ page }) => {
	await openStudio(page);
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await openApp(page, '⚡  能量单位换算');
	const window = page.locator('.mini-app-window[data-app="energy-units"]');
	await expect(window.locator('.mini-app-title')).toHaveText('⚡ 能量单位换算');
	const frame = appFrame(page, 'energy-units');
	await frame.locator('#value').fill('1');
	await frame.locator('#unit').selectOption('Eh');
	const kcal = frame.locator('tr', { hasText: 'kcal/mol' });
	await expect(kcal.locator('.value')).toHaveText('627.509');
	await kcal.getByRole('button', { name: '插入' }).click();
	await expect(editor(page).locator('.pm-inline-math')).toHaveCount(3);
	// The keys are the window's while it has them: back in the article to save.
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toContain('$\\pu{627.509 kcal.mol-1}$');
	// Closed from its bar.
	await window.getByRole('button', { name: '关闭 能量单位换算' }).click();
	await expect(window).toHaveCount(0);
});

test('Gaussian 输入生成 takes a structure of the article and saves an input into its assets/', async ({ page }) => {
	writeFixtureFile('assets/h2o.xyz', '3\nwater\nO 0.000000 0.000000 0.117300\nH 0.000000 0.757200 -0.469200\nH 0.000000 -0.757200 -0.469200\n');
	await openStudio(page);
	await openApp(page, '⚛  Gaussian 输入生成');
	const frame = appFrame(page, 'gaussian-input');
	await frame.locator('#source').selectOption('assets/h2o.xyz');
	await expect(frame.locator('#preview')).toContainText('#p B3LYP/def2SVP opt freq em=GD3BJ');
	await expect(frame.locator('#preview')).toContainText('O      0.000000     0.000000     0.117300');
	await frame.getByRole('button', { name: '存成 assets/ 里的 .gjf' }).click();
	await expect(page.locator('.studio-toast', { hasText: '已存成 assets/h2o.gjf' })).toBeVisible();
	const saved = readFileSync(join(process.env.STUDIO_BLOG_DIR!, slug, 'assets', 'h2o.gjf'), 'utf8');
	expect(saved).toMatch(/^%nprocshared=16\n%mem=32GB\n%chk=h2o\.chk\n#p B3LYP\/def2SVP opt freq em=GD3BJ\n\nh2o\n\n0 1\nO /u);
});

test('an app that did not ask for the article cannot read it', async ({ page }) => {
	const folder = join(apps(), 'probe');
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, 'app.json'), JSON.stringify({ name: '探针', icon: '?', permissions: [] }));
	writeFileSync(join(folder, 'app.html'), '<p id="out">…</p><script>studio.article().then((a) => { out.textContent = a.slug; }, (e) => { out.textContent = e.message; });</script>');
	try {
		await openStudio(page);
		await openApp(page, '?  探针');
		await expect(appFrame(page, 'probe').locator('#out')).toHaveText('「探针」的 app.json 里没有要「article」权限');
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});
