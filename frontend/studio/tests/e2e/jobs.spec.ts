import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, fixtureHas, openStudio, resetFixture, retainmolFrame, savedMarkdown, saveStatus } from './studio.ts';

// A calculation in the page, as in a notebook: a ```job block's molecule is
// built (in RetainMol), the job set up, run from the page, followed as it
// goes, and drawn when it ends; each run kept. xtb here is
// tests/e2e/fixtures/bin/xtb, which writes a real run's outputs; RetainMol
// is its stand-in (studio.ts), which speaks its embedded mode's messages.

const FAKE_XTB = fileURLToPath(new URL('./fixtures/bin/xtb', import.meta.url));
const settings = () => join(process.env.STUDIO_BLOG_DIR as string, '.studio-settings.json');
let work = '';

const WATER = '3\nwater\nO 0 0 0.1173\nH 0 0.7572 -0.4692\nH 0 -0.7572 -0.4692';

test.beforeEach(() => {
	resetFixture();
	work = mkdtempSync(join(tmpdir(), 'studio-e2e-jobs-'));
	writeFileSync(settings(), JSON.stringify({ computeHosts: [{ name: 'local', kind: 'local', workdir: work, threads: 2, programs: { xtb: FAKE_XTB } }] }));
});
test.afterEach(() => {
	rmSync(settings(), { force: true });
	rmSync(work, { recursive: true, force: true });
});

const block = (page: Page) => editor(page).locator('.job-block');
const sheet = (page: Page) => page.locator('dialog.block-sheet[open]');
const field = (page: Page, name: string) => sheet(page).locator('.job-field', { has: page.locator('.job-field-name', { hasText: new RegExp(`^${name}$`, 'u') }) }).locator('select, input');
const tab = (page: Page, name: string) => sheet(page).locator('.block-sheet-tab', { hasText: name });
const runs = (id: string) => (fixtureHas(`assets/jobs/${id}`) ? readdirSync(join(process.env.STUDIO_BLOG_DIR as string, 'studio-fixture', 'assets', 'jobs', id)).sort() : []);

test('a calculation is a card; its sheet sets it up, runs it, shows what it found, and keeps each run', async ({ page }) => {
	appendToFixture(`\n\`\`\`job id=water-opt program=xtb args="--opt" host=local\n${WATER}\n\`\`\`\n`);
	await openStudio(page, { autosaveDelay: 300 });
	const job = block(page);
	// In the page, two lines: never run.
	await expect(job.locator('.job-card-title')).toHaveText('未命名计算');
	await expect(job.locator('.job-card-line')).toHaveText('还没有运行');
	await expect(job.locator('.job-card-describe')).toHaveText('xtb · 结构优化 · GFN2-xTB');
	await expect(job.locator('.job-settings')).toHaveCount(0);

	// Double-clicked, never run: its sheet, on 搭建, its structure given to RetainMol; then its form.
	await job.dblclick();
	await expect(sheet(page)).toBeVisible();
	await expect(tab(page, '搭建')).toHaveAttribute('aria-selected', 'true');
	await expect(sheet(page)).toHaveClass(/is-wide/);
	await expect(retainmolFrame(page).locator('#loaded')).toHaveText('3 / water');
	await tab(page, '设置').click();
	await expect(sheet(page)).not.toHaveClass(/is-wide/);
	await expect(sheet(page).locator('.job-structure-info')).toHaveText('H2O · 3 个原子');
	await expect(sheet(page).locator('.job-structure .job-stage canvas')).toBeVisible();

	// The form writes the command line, and the command line the fence.
	await field(page, '任务').selectOption('ohess');
	await field(page, '溶剂模型').selectOption('alpb');
	await expect(sheet(page).locator('.job-args')).toHaveValue('--ohess --alpb water');
	await field(page, '名称').fill('水的优化和频率');
	await expect(job.locator('.job-card-title')).toHaveText('水的优化和频率');
	await expect(sheet(page).locator('.block-sheet-title')).toHaveText('水的优化和频率');
	await expect.poll(savedMarkdown).toContain('```job id=water-opt program=xtb args="--ohess --alpb water" host=local title=水的优化和频率\n3\nwater');

	// Run (⌘↩): the sheet goes to its results.
	await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
	await expect(tab(page, '结果')).toHaveAttribute('aria-selected', 'true');
	await expect(sheet(page).locator('.job-state')).toHaveText('完成');
	const [first] = runs('water-opt');
	expect(first).toMatch(/^\d{8}-\d{6}$/u);
	await expect.poll(savedMarkdown).toContain(`title=水的优化和频率 run=${first}\n`);
	await expect(sheet(page).locator('.job-number', { hasText: '总能量' }).locator('dd')).toHaveText('-11.394339 Eh');
	await expect(sheet(page).locator('.job-number', { hasText: '自由能 G' }).locator('dd')).toHaveText('-11.341580 Eh');
	await expect(sheet(page).locator('.job-chart')).toContainText('结构优化');
	await expect(sheet(page).locator('.job-mode')).toHaveCount(21);
	await sheet(page).locator('.job-mode button', { hasText: '1045.7' }).click();
	await expect(sheet(page).locator('.job-mode-label')).toHaveText('第 12 个振动：1045.7 cm⁻¹，强度 47.8 km/mol');
	await expect(sheet(page).locator('.job-vibration-view canvas')).toBeVisible();
	await tab(page, '输出').click();
	await expect(sheet(page).locator('.job-log-text')).toContainText('normal termination of xtb');

	// The card: a few numbers and the structure, small.
	await expect(job.locator('.job-card-line')).toHaveText('E −11.39434 Eh  ·  G −11.34158 Eh  ·  能隙 12.89 eV  ·  无虚频');
	await expect(job.locator('.job-thumbnail circle')).toHaveCount(3);
	const record = JSON.parse(readFileSync(join(process.env.STUDIO_BLOG_DIR as string, 'studio-fixture', 'assets/jobs/water-opt', first, 'run.json'), 'utf8'));
	expect(record).toMatchObject({ state: 'done', exitCode: 0, command: 'xtb input.xyz --ohess --alpb water --parallel 2' });
	expect(record.files).toEqual(['g98.out', 'input.xyz', 'vibspectrum', 'xtb.out', 'xtbopt.log', 'xtbopt.xyz']);

	// Again, as an optimization only: both runs kept, the older one there to go back to.
	await tab(page, '设置').click();
	await field(page, '任务').selectOption('opt');
	await page.waitForTimeout(1100);
	await sheet(page).locator('.block-sheet-action', { hasText: '运行' }).click();
	await expect.poll(() => runs('water-opt').length).toBe(2);
	await expect(sheet(page).locator('.job-state')).toHaveText('完成');
	await expect(sheet(page).locator('.job-mode')).toHaveCount(0);
	await expect(job.locator('.job-card-line')).not.toContainText('虚频');
	await tab(page, '历史').click();
	const rows = sheet(page).locator('.job-run-row');
	await expect(rows).toHaveCount(2);
	await expect(rows.first()).toContainText('页面显示这次');
	await rows.nth(1).click();
	await expect(tab(page, '结果')).toHaveAttribute('aria-selected', 'true');
	await expect(sheet(page).locator('.job-mode')).toHaveCount(21);
	await expect.poll(savedMarkdown).toContain(`run=${first}\n`);
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toHaveCount(0);
	await expect(job.locator('.job-card-line')).toContainText('无虚频');

	// Built anew in RetainMol: the same frame as before, given this block's molecule again (a new session).
	const frame = await page.locator('iframe.retainmol-frame').elementHandle();
	await job.dblclick();
	await tab(page, '搭建').click();
	await expect(page.locator('iframe.retainmol-frame')).toHaveCount(1);
	expect(await page.evaluate((before) => before === document.querySelector('iframe.retainmol-frame'), frame)).toBe(true);
	await expect.poll(() => retainmolFrame(page).locator('body').evaluate(() => (window as unknown as { loads: number }).loads)).toBe(2);
	await expect(retainmolFrame(page).locator('#loaded')).toHaveText('3 / water');
	await retainmolFrame(page).locator('#build').click();
	await expect(sheet(page).locator('.block-sheet-note')).toHaveText('CH4O · 6 个原子，已写进块里。');
	await expect(job.locator('.job-card-describe')).toContainText('结构改过了，这是改之前的结果');
	// ⌘S in RetainMol's frame saves the article.
	await retainmolFrame(page).locator('#save').click();
	// Polled: 已保存 may still be the save before this one's.
	await expect.poll(savedMarkdown).toContain('\n6\nmethanol\nC 0.000000 0.000000 0.000000\nO 1.420000');
	await expect(saveStatus(page)).toHaveText('已保存');
	// And the 设置 tab shows it as text.
	await tab(page, '设置').click();
	await expect(sheet(page).locator('.job-structure-info')).toHaveText('CH4O · 6 个原子');
});

test('another run shown: its card says it is reading, and shows it even when its record comes anew meanwhile', async ({ page }) => {
	appendToFixture(`\n\`\`\`job id=two program=xtb args="--ohess" host=local\n${WATER}\n\`\`\`\n`);
	await openStudio(page, { autosaveDelay: 300 });
	const job = block(page);
	await job.dblclick();
	const runButton = sheet(page).locator('.block-sheet-action', { hasText: '运行' });
	await runButton.click();
	await expect(sheet(page).locator('.job-state')).toHaveText('完成');
	// Another second, another run's folder.
	await page.waitForTimeout(1100);
	await runButton.click();
	await expect.poll(() => runs('two').length).toBe(2);
	await expect(sheet(page).locator('.job-state')).toHaveText('完成');
	const [first] = runs('two');

	// The first run's files held back until the block has loaded its runs again (a file of theirs changed on disk).
	let release = () => {};
	const released = new Promise<void>((resolve) => (release = resolve));
	await page.route(`**/assets/jobs/two/${first}/**`, async (route) => {
		await released;
		await route.continue();
	});
	try {
		await tab(page, '历史').click();
		await sheet(page).locator('.job-run-row').nth(1).click();
		await page.keyboard.press('Escape');
		await expect(job.locator('.job-card-line')).toHaveText('正在读取结果…');
		const reloaded = page.waitForResponse((response) => response.url().endsWith('/jobs/two/runs'));
		writeFileSync(join(process.env.STUDIO_BLOG_DIR as string, 'studio-fixture', 'assets/jobs/two', first, 'note.txt'), '看过了');
		await reloaded;
		await expect(job.locator('.job-card-line')).toHaveText('正在读取结果…');
	} finally {
		release();
	}
	await expect(job.locator('.job-card-line')).toContainText('无虚频');
});

test('a long run followed in its card and its sheet, and stopped from the card', async ({ page }) => {
	appendToFixture(`\n\`\`\`job id=slow program=xtb args="--opt --slow" host=local title=慢\n${WATER}\n\`\`\`\n`);
	await openStudio(page, { autosaveDelay: 300 });
	const job = block(page);
	await job.hover();
	await job.locator('.job-run').click();
	await expect(job.locator('.job-state')).toHaveText('运行中');
	await expect(job.locator('.job-run')).toHaveText('停止');
	await expect(job.locator('.job-card-progress')).toBeVisible();
	await expect(job.locator('.job-card-when')).toHaveText(/已运行 \d/u);
	await expect(job.locator('.job-card-line')).toHaveText(/^第 \d+ 步/u);
	// Its output, as it comes.
	await job.dblclick();
	await tab(page, '输出').click();
	await expect(sheet(page).locator('.job-log-text')).toContainText('xtb version 6.7.1');
	await expect(sheet(page).locator('.block-sheet-action')).toHaveText('停止');
	await page.keyboard.press('Escape');
	await job.hover();
	await job.locator('.job-run').click();
	await expect(job.locator('.job-state')).toHaveText('已停止');
	await expect(job.locator('.job-run')).toHaveText('运行');
});

test('a block made from the slash menu opens on 搭建; its form; and the machines it can run on', async ({ page }) => {
	await openStudio(page, { autosaveDelay: 300 });
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/xtb');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index] .menu-item-label').first()).toHaveText('计算（xtb / CREST）');
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await expect(block(page)).toHaveCount(1);
	await expect(sheet(page)).toBeVisible();
	await expect(tab(page, '搭建')).toHaveAttribute('aria-selected', 'true');
	await expect(retainmolFrame(page).locator('#loaded')).toHaveText('（空）');
	await expect(sheet(page).locator('.block-sheet-note')).toContainText('在这里搭出分子');
	await expect.poll(savedMarkdown).toMatch(/```job id=job-[a-z0-9]{6} program=xtb args=--opt host=local\n```/u);
	await tab(page, '设置').click();
	// xtb's level shows for an optimization only.
	await expect(field(page, '优化精度')).toBeVisible();
	await field(page, '任务').selectOption('sp');
	await expect(field(page, '优化精度')).toBeHidden();
	await field(page, '电荷').fill('-1');
	await expect(sheet(page).locator('.job-args')).toHaveValue('--chrg -1');
	// CREST instead: its own fields; what both have (the charge) is kept.
	await field(page, '程序').selectOption('crest');
	await expect(sheet(page).locator('.job-args')).toHaveValue('--gfn2 --chrg -1');
	await expect(field(page, '能量窗口 kcal/mol')).toBeVisible();
	await expect(field(page, '任务')).toHaveCount(0);
	await expect(block(page).locator('.job-card-describe')).toHaveText('CREST · 构象搜索 · GFN2-xTB · 电荷 -1');
	// No structure yet: a run is refused, saying why.
	page.once('dialog', (dialog) => {
		expect(dialog.message()).toContain('还没有结构');
		void dialog.accept();
	});
	await sheet(page).locator('.block-sheet-action', { hasText: '运行' }).click();

	// 计算机器: one more, reached by ssh, handed to Slurm.
	await field(page, '机器').selectOption('__manage');
	const dialog = page.locator('#compute-hosts-dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('.host-card')).toHaveCount(1);
	await dialog.locator('#compute-hosts-add').click();
	const card = dialog.locator('.host-card').nth(1);
	await card.locator('[data-key="name"]').fill('cluster');
	await card.locator('[data-key="label"]').fill('课题组集群');
	await card.locator('[data-key="ssh"]').fill('me@cluster.example');
	await card.locator('[data-key="scheduler"]').selectOption('slurm');
	await card.locator('[data-key="partition"]').fill('batch');
	await dialog.locator('#compute-hosts-save').click();
	await expect(dialog).toBeHidden();
	const kept = JSON.parse(readFileSync(settings(), 'utf8')).computeHosts;
	expect(kept.map((host: { name: string }) => host.name)).toEqual(['local', 'cluster']);
	expect(kept[1]).toMatchObject({ kind: 'ssh', ssh: 'me@cluster.example', scheduler: 'slurm', partition: 'batch', label: '课题组集群' });
	await field(page, '机器').selectOption('cluster');
	await expect.poll(savedMarkdown).toMatch(/args="--gfn2 --chrg -1" host=cluster\n```/u);
});
