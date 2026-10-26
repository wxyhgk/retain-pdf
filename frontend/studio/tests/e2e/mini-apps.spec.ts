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
	await untilFrameTakesPointer(page);
}

/**
 * Until the window just opened has its frame taking the pointer: for a moment after a frame is put in the page, the
 * browser gives a click there to the page instead (to the frame element), and the app never hears it.
 */
async function untilFrameTakesPointer(page: Page): Promise<void> {
	const element = page.locator('.mini-app-window iframe').last();
	await expect(element).toBeVisible();
	// Chromium's (WebKit gives a click there to the frame at once; the pointer moved over it, it tells the frame nothing).
	if (page.context().browser()?.browserType().name() !== 'chromium') return;
	await expect
		.poll(async () => {
			const frame = await (await element.elementHandle())?.contentFrame();
			const box = await element.boundingBox();
			if (!frame || !box) return false;
			const heard = await frame.evaluate(() => {
				const marked = window as { pointerHeard?: boolean };
				if (marked.pointerHeard === undefined) {
					marked.pointerHeard = false;
					addEventListener('pointermove', () => (marked.pointerHeard = true), { once: true });
				}
				return marked.pointerHeard;
			});
			if (!heard) await page.mouse.move(box.x + box.width / 2 + Math.random() * 4, box.y + box.height / 2);
			return heard;
		})
		.toBe(true);
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

/** An app of the test's own in apps/, removed after `run`. */
async function withApp(files: Record<string, string>, run: () => Promise<void>): Promise<void> {
	const folder = join(apps(), 'probe');
	mkdirSync(folder, { recursive: true });
	for (const [name, text] of Object.entries(files)) writeFileSync(join(folder, name), text);
	try {
		await run();
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

test('a page the app’s frame goes to (a link clicked) gets nothing of the Studio; the app’s own files load', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?', permissions: ['article'] }),
			'app.html': '<a id="go" href="./other.html">去别处</a><p id="out">…</p><p id="data">…</p><script>studio.article().then((a) => { out.textContent = a.slug; }); studio.appFile("data.json").then((t) => { data.textContent = JSON.parse(t).value; }, (e) => { data.textContent = e.message; });</script>',
			'data.json': JSON.stringify({ value: '数据读到了' }),
			// What a page out on the web could do once in the frame: say it is ready, and ask.
			'other.html': '<p id="out">…</p><script>let heard = false; addEventListener("message", (e) => { heard = true; out.textContent = "answered " + JSON.stringify(e.data); }); parent.postMessage({ kind: "studio-app", type: "ready" }, "*"); parent.postMessage({ kind: "studio-app", type: "call", id: 1, method: "article", args: [] }, "*"); setTimeout(() => { if (!heard) out.textContent = "silent"; }, 1500);</script>',
		},
		async () => {
			await openStudio(page);
			await openApp(page, '?  探针');
			const frame = appFrame(page, 'probe');
			await expect(frame.locator('#out')).toHaveText(slug);
			await expect(frame.locator('#data')).toHaveText('数据读到了');
			await frame.locator('#go').click();
			await expect(page.locator('.studio-toast', { hasText: '打开了别的网页' })).toBeVisible();
			await expect(frame.locator('#out')).toHaveText('silent');
			// ↻ brings the app back, and its line with it.
			await page.locator('.mini-app-window[data-app="probe"] .mini-app-bar button', { hasText: '↻' }).click();
			await expect(frame.locator('#out')).toHaveText(slug);
		},
	);
});

test('an app may not reach this machine through studio.fetch, nor the Studio’s API opened on its own; nor may other local pages', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?', permissions: ['net'] }),
			'app.html': '<p id="out">…</p><script>studio.fetch(new URL("/api/studio/agents", location.href).href, { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => { out.textContent = "reached " + r.status; }, (e) => { out.textContent = e.message; });</script>',
		},
		async () => {
			await openStudio(page);
			const own = new URL(page.url()).origin;
			await openApp(page, '?  探针');
			await expect(appFrame(page, 'probe').locator('#out')).toContainText('小程序不能访问本机或局域网的地址');
			// Opened as a page of its own, the app has no origin either: the API refuses it.
			await page.goto(`${own}/studio-apps/probe/`);
			expect(await page.evaluate(() => fetch('/api/studio/agents').then((r) => r.status, () => 'blocked'))).not.toBe(200);
			// A page of another server on this machine (another port) is refused; the Studio's own is not.
			expect((await page.request.get(`${own}/api/studio/agents`, { headers: { origin: 'http://localhost:3999' } })).status()).toBe(403);
			expect((await page.request.get(`${own}/api/studio/agents`, { headers: { 'sec-fetch-site': 'same-site' } })).status()).toBe(403);
			expect((await page.request.get(`${own}/api/studio/agents`, { headers: { origin: own } })).status()).toBe(200);
		},
	);
});

test('a window opens roomy, is sized from its edges and corners, made large by a double-click, and opens again as it was left', async ({ page }) => {
	await openStudio(page);
	await openApp(page, '⚡  能量单位换算');
	const window = page.locator('.mini-app-window[data-app="energy-units"]');
	const box = async () => (await window.boundingBox())!;
	const opened = await box();
	expect(opened.width).toBeGreaterThanOrEqual(420);
	expect(opened.height).toBeGreaterThanOrEqual(520);
	/** Drags the grip on `edge` by (dx, dy). */
	const pull = async (edge: string, dx: number, dy: number) => {
		const grip = (await window.locator(`.mini-app-grip[data-edge="${edge}"]`).boundingBox())!;
		const x = grip.x + grip.width / 2;
		const y = grip.y + grip.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + dx / 2, y + dy / 2);
		await page.mouse.move(x + dx, y + dy);
		await page.mouse.up();
	};
	// The left edge out: wider, the right edge where it was.
	await pull('w', -100, 0);
	let now = await box();
	expect(Math.round(now.width)).toBe(Math.round(opened.width + 100));
	expect(Math.round(now.x + now.width)).toBe(Math.round(opened.x + opened.width));
	// The corner below right in: smaller both ways, not below the least.
	await pull('se', -1000, -1000);
	now = await box();
	expect(Math.round(now.width)).toBe(280);
	expect(Math.round(now.height)).toBe(180);
	await pull('se', 120, 200);
	const left = await box();
	// Double-click on the bar: as large as the page allows; again: as it was.
	await window.locator('.mini-app-title').dblclick();
	const viewport = page.viewportSize()!;
	await expect.poll(async () => Math.round((await box()).width)).toBe(viewport.width - 32);
	await window.locator('.mini-app-title').dblclick();
	await expect.poll(async () => Math.round((await box()).width)).toBe(Math.round(left.width));
	// Closed and opened again: where and as large as it was left.
	await window.getByRole('button', { name: '关闭 能量单位换算' }).click();
	await openApp(page, '⚡  能量单位换算');
	const again = await box();
	expect([again.x, again.y, again.width, again.height].map(Math.round)).toEqual([left.x, left.y, left.width, left.height].map(Math.round));
});
