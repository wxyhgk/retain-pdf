import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, fixtureHas, openStudio, resetFixture, savedMarkdown } from './studio.ts';

// A calculation in the page, as in a notebook: a ```job block is set up, run
// from the page, followed as it goes, and drawn when it ends; each run kept.
// xtb here is tests/e2e/fixtures/bin/xtb, which writes a real run's outputs.

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
const runs = (id: string) => (fixtureHas(`assets/jobs/${id}`) ? readdirSync(join(process.env.STUDIO_BLOG_DIR as string, 'studio-fixture', 'assets', 'jobs', id)).sort() : []);

test('a calculation set up from its form, run here, drawn when it ends, and each run kept', async ({ page }) => {
	appendToFixture(`\n\`\`\`job id=water-opt program=xtb args="--opt" host=local\n${WATER}\n\`\`\`\n`);
	await openStudio(page, { autosaveDelay: 300 });
	const job = block(page);
	await expect(job.locator('.job-summary')).toHaveText('xtb · 结构优化 · GFN2-xTB');
	// Never run: its form is open, with its structure drawn.
	await expect(job.locator('.job-settings')).toBeVisible();
	await expect(job.locator('.job-structure-info')).toHaveText('H2O · 3 个原子');
	await expect(job.locator('.job-structure .job-stage canvas')).toBeVisible();

	// The form writes the command line, and the command line the fence.
	await job.locator('.job-field', { hasText: '任务' }).locator('select').selectOption('ohess');
	await job.locator('.job-field', { hasText: '溶剂模型' }).locator('select').selectOption('alpb');
	await expect(job.locator('.job-args')).toHaveValue('--ohess --alpb water');
	await job.locator('.job-title').fill('水的优化和频率');
	await expect.poll(savedMarkdown).toContain('```job id=water-opt program=xtb args="--ohess --alpb water" host=local title=水的优化和频率\n3\nwater');

	await job.locator('.job-run').click();
	await expect(job.locator('.job-state')).toHaveText('完成');
	const [first] = runs('water-opt');
	expect(first).toMatch(/^\d{8}-\d{6}$/u);
	await expect.poll(savedMarkdown).toContain(`title=水的优化和频率 run=${first}\n`);
	// What it found: the numbers, the optimization, the spectrum; a mode to watch vibrate.
	await expect(job.locator('.job-number', { hasText: '总能量' }).locator('dd')).toHaveText('-11.394339 Eh');
	await expect(job.locator('.job-number', { hasText: '自由能 G' }).locator('dd')).toHaveText('-11.341580 Eh');
	await expect(job.locator('.job-number', { hasText: '虚频' }).locator('dd')).toHaveText('0');
	await expect(job.locator('.job-chart')).toContainText('结构优化');
	await expect(job.locator('.job-mode')).toHaveCount(21);
	await job.locator('.job-mode button', { hasText: '1045.7' }).click();
	await expect(job.locator('.job-mode-label')).toHaveText('第 12 个振动：1045.7 cm⁻¹，强度 47.8 km/mol');
	await expect(job.locator('.job-vibration-view canvas')).toBeVisible();
	// The run is in the article, without the program's scratch.
	const record = JSON.parse(readFileSync(join(process.env.STUDIO_BLOG_DIR as string, 'studio-fixture', 'assets/jobs/water-opt', first, 'run.json'), 'utf8'));
	expect(record).toMatchObject({ state: 'done', exitCode: 0, command: 'xtb input.xyz --ohess --alpb water --parallel 2' });
	expect(record.files).toEqual(['g98.out', 'input.xyz', 'vibspectrum', 'xtb.out', 'xtbopt.log', 'xtbopt.xyz']);

	// Again, as an optimization only: both runs kept, the older one there to go back to.
	await job.locator('.job-settings-button').click();
	await job.locator('.job-field', { hasText: '任务' }).locator('select').selectOption('opt');
	await page.waitForTimeout(1100);
	await job.locator('.job-run').click();
	await expect.poll(() => runs('water-opt').length).toBe(2);
	await expect(job.locator('.job-state')).toHaveText('完成');
	await expect(job.locator('.job-mode')).toHaveCount(0);
	await expect(job.locator('.job-section-title', { hasText: '优化后的结构' })).toBeVisible();
	const history = job.locator('.job-history');
	await expect(history.locator('option')).toHaveCount(2);
	await history.selectOption(first);
	await expect(job.locator('.job-mode')).toHaveCount(21);
	await expect.poll(savedMarkdown).toContain(`run=${first}\n`);
});

test('a long run followed as it goes, and stopped from its block', async ({ page }) => {
	appendToFixture(`\n\`\`\`job id=slow program=xtb args="--opt --slow" host=local title=慢\n${WATER}\n\`\`\`\n`);
	await openStudio(page, { autosaveDelay: 300 });
	const job = block(page);
	await job.locator('.job-run').click();
	await expect(job.locator('.job-state')).toHaveText('运行中');
	await expect(job.locator('.job-run')).toHaveText('停止');
	// Its output, as it comes: open, at its newest lines.
	await expect(job.locator('.job-log')).toHaveAttribute('open', '');
	await expect(job.locator('.job-log-text')).toContainText('xtb version 6.7.1');
	await expect(job.locator('.job-facts')).toContainText(/已运行 \d/u);
	await job.locator('.job-run').click();
	await expect(job.locator('.job-state')).toHaveText('已停止');
	await expect(job.locator('.job-run')).toHaveText('运行');
});

test('a block made from the slash menu, and the machines it can run on', async ({ page }) => {
	await openStudio(page, { autosaveDelay: 300 });
	await editor(page).locator('p', { hasText: '结尾段落' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/xtb');
	await expect(page.locator('.milkdown-slash-menu .menu-groups [data-index]').first()).toHaveText('计算（xtb / CREST）');
	// Crepe takes in the typing 20 ms late (a debounce); a person is slower than that.
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	const job = block(page);
	await expect(job).toHaveCount(1);
	await expect(job.locator('.job-empty')).toHaveText(/还没有运行/u);
	await expect.poll(savedMarkdown).toMatch(/```job id=job-[a-z0-9]{6} program=xtb args=--opt host=local\n```/u);
	// CREST instead: its own tasks and methods.
	await job.locator('.job-field', { hasText: '程序' }).locator('select').selectOption('crest');
	await expect(job.locator('.job-args')).toHaveValue('--gfn2');
	await expect(job.locator('.job-summary')).toHaveText('CREST · 构象搜索 · GFN2-xTB');
	// No structure yet: a run is refused, saying why.
	page.once('dialog', (dialog) => {
		expect(dialog.message()).toContain('还没有结构');
		void dialog.accept();
	});
	await job.locator('.job-run').click();

	// 计算机器: one more, reached by ssh, handed to Slurm.
	await job.locator('.job-field', { hasText: '机器' }).locator('select').selectOption('__manage');
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
	await job.locator('.job-field', { hasText: '机器' }).locator('select').selectOption('cluster');
	await expect.poll(savedMarkdown).toMatch(/args=--gfn2 host=cluster\n```/u);
});
