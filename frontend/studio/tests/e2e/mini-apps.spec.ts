import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, fixtureHas, openStudio, resetFixture, saveStatus, savedMarkdown, slug, writeFixtureFile } from './studio.ts';
import { picturePath } from '../../plugins/app-blocks/app-blocks.mjs';

// 小程序: the tools of apps/ (two to begin with: energy-units, gaussian-input), each in a floating window, in a frame
// that reaches the Studio only through `studio`, and only for what its app.json asks.

/** The apps/ of the server's own copy of the repository (E2E_ISOLATED). */
const apps = () => join(process.env.E2E_ROOT_PARENT!, basename(fileURLToPath(new URL('../..', import.meta.url))), 'apps');

/** An app opened from the 小程序 page in a floating window (⧉), as it is used beside an article; back to the article. */
async function openApp(page: Page, name: string): Promise<void> {
	await page.locator('#open-apps').click();
	await page.locator('.app-card', { has: page.locator('.app-card-name', { hasText: new RegExp(`^${name}$`, 'u') }) }).locator('.app-card-window').click();
	await page.locator('#article-list').getByText('Studio 测试夹具').first().click();
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
	await openApp(page, '能量单位换算');
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
	await openApp(page, 'Gaussian 输入生成');
	const frame = appFrame(page, 'gaussian-input');
	await frame.locator('#source').selectOption('assets/h2o.xyz');
	await expect(frame.locator('#preview')).toContainText('#p B3LYP/def2SVP opt freq em=GD3BJ');
	await expect(frame.locator('#preview')).toContainText('O      0.000000     0.000000     0.117300');
	await frame.getByRole('button', { name: '存成 assets/ 里的 .gjf' }).click();
	await expect(page.locator('.studio-toast', { hasText: '已存成 assets/h2o.gjf' })).toBeVisible();
	const saved = readFileSync(join(process.env.STUDIO_BLOG_DIR!, slug, 'assets', 'h2o.gjf'), 'utf8');
	expect(saved).toMatch(/^%nprocshared=16\n%mem=32GB\n%chk=h2o\.chk\n#p B3LYP\/def2SVP opt freq em=GD3BJ\n\nh2o\n\n0 1\nO /u);
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

// What a page out on the web could do once in the frame (another origin: here a data: address): say it is ready, and ask.
const ELSEWHERE = `data:text/html,${encodeURIComponent('<p id="out">…</p><script>let heard = false; addEventListener("message", (e) => { heard = true; out.textContent = "answered " + JSON.stringify(e.data); }); parent.postMessage({ kind: "studio-app", type: "ready" }, "*"); parent.postMessage({ kind: "studio-app", type: "call", id: 1, method: "article", args: [] }, "*"); setTimeout(() => { if (!heard) out.textContent = "silent"; }, 1500);</script>')}`;

test('a page the app’s frame goes to (a link clicked) gets nothing of the Studio; the app’s own files load', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?' }),
			'app.html': `<a id="go" href="${ELSEWHERE.replaceAll('"', '&quot;')}">去别处</a><p id="out">…</p><p id="data">…</p><script>studio.article().then((a) => { out.textContent = a.slug; }); studio.appFile("data.json").then((t) => { data.textContent = JSON.parse(t).value; }, (e) => { data.textContent = e.message; });</script>`,
			'data.json': JSON.stringify({ value: '数据读到了' }),
		},
		async () => {
			await openStudio(page);
			await openApp(page, '探针');
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

test('an app is the author’s own, not sandboxed: it loads its own files and the Studio’s, and may do all it asks', async ({ page }) => {
	await withApp(
		{
			// No permissions asked for.
			'app.json': JSON.stringify({ name: '探针', icon: '?' }),
			'app.html': [
				'<p id="article">…</p><p id="lib">…</p><p id="data">…</p><p id="module">…</p><p id="api">…</p><p id="local">…</p><p id="stored">…</p>',
				'<script src="./lib.js"></script>',
				'<script type="module">import { word } from "./part.mjs"; module.textContent = word;</script>',
				'<script>',
				'studio.article().then((a) => { article.textContent = a.slug; }, (e) => { article.textContent = e.message; });',
				'lib.textContent = typeof fromLib === "string" ? fromLib : "no lib";',
				'fetch("./data.json").then((r) => r.json()).then((d) => { data.textContent = d.value; }, (e) => { data.textContent = e.message; });',
				'fetch("/api/studio/apps").then((r) => { api.textContent = String(r.status); }, (e) => { api.textContent = e.message; });',
				'studio.fetch(new URL("/api/studio/apps", location.href).href).then((r) => { local.textContent = String(r.status); }, (e) => { local.textContent = e.message; });',
				'localStorage.setItem("probe", "kept"); stored.textContent = localStorage.getItem("probe");',
				'</script>',
			].join(''),
			'lib.js': 'var fromLib = "库读到了";',
			'part.mjs': 'export const word = "模块读到了";',
			'data.json': JSON.stringify({ value: '数据读到了' }),
		},
		async () => {
			await openStudio(page);
			await openApp(page, '探针');
			const frame = appFrame(page, 'probe');
			await expect(frame.locator('#article')).toHaveText(slug);
			await expect(frame.locator('#lib')).toHaveText('库读到了');
			await expect(frame.locator('#module')).toHaveText('模块读到了');
			await expect(frame.locator('#data')).toHaveText('数据读到了');
			await expect(frame.locator('#api')).toHaveText('200');
			await expect(frame.locator('#local')).toHaveText('200');
			await expect(frame.locator('#stored')).toHaveText('kept');
		},
	);
});

test('the Studio’s API and its apps are still not another server’s, nor another site’s', async ({ page }) => {
	await openStudio(page);
	const own = new URL(page.url()).origin;
	// A page of another server on this machine (another port) is refused; the Studio's own is not.
	expect((await page.request.get(`${own}/api/studio/agents`, { headers: { origin: 'http://localhost:3999' } })).status()).toBe(403);
	expect((await page.request.get(`${own}/api/studio/agents`, { headers: { 'sec-fetch-site': 'same-site' } })).status()).toBe(403);
	expect((await page.request.get(`${own}/api/studio/agents`, { headers: { origin: own } })).status()).toBe(200);
	// Not sandboxed, an app is not another site's to open: it would act as the Studio.
	expect((await page.request.get(`${own}/studio-apps/energy-units/`, { headers: { 'sec-fetch-site': 'cross-site' } })).status()).toBe(403);
	expect((await page.request.get(`${own}/studio-apps/energy-units/`, { headers: { 'sec-fetch-site': 'same-origin' } })).status()).toBe(200);
});

test('a window opens roomy, is sized from its edges and corners, made large by a double-click, and opens again as it was left', async ({ page }) => {
	await openStudio(page);
	await openApp(page, '能量单位换算');
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
	await openApp(page, '能量单位换算');
	const again = await box();
	expect([again.x, again.y, again.width, again.height].map(Math.round)).toEqual([left.x, left.y, left.width, left.height].map(Math.round));
});

test('another page of the app’s own folder is the app’s: it has `studio` too', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?' }),
			'app.html': '<a id="go" href="./second.html">第二页</a>',
			'second.html': '<p id="out">…</p><script>studio.article().then((a) => { out.textContent = "第二页 " + a.slug; });</script>',
		},
		async () => {
			await openStudio(page);
			await openApp(page, '探针');
			await appFrame(page, 'probe').locator('#go').click();
			await expect(appFrame(page, 'probe').locator('#out')).toHaveText(`第二页 ${slug}`);
			await expect(page.locator('.studio-toast', { hasText: '打开了别的网页' })).toHaveCount(0);
		},
	);
});

test('a page app is loaded again in its window when its file is saved, and keeps `studio`', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?' }),
			'app.html': '<p id="out">…</p><script>studio.article().then((a) => { out.textContent = "一 " + a.slug; });</script>',
		},
		async () => {
			await openStudio(page);
			await openApp(page, '探针');
			const frame = appFrame(page, 'probe');
			await expect(frame.locator('#out')).toHaveText(`一 ${slug}`);
			writeFileSync(join(apps(), 'probe', 'app.html'), '<p id="out">…</p><script>studio.article().then((a) => { out.textContent = "二 " + a.slug; });</script>');
			await expect(frame.locator('#out')).toHaveText(`二 ${slug}`);
		},
	);
});

test('what goes wrong in an app shows on its bar, and is put to the AI to mend', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?' }),
			'app.html': '<button id="boom">炸</button><script>boom.onclick = () => { throw new Error("算不出来：除以零"); }; console.error("单位不对", { value: 3 });</script>',
		},
		async () => {
			await openStudio(page);
			await openApp(page, '探针');
			const window = page.locator('.mini-app-window[data-app="probe"]');
			const badge = window.locator('.mini-app-errors');
			await expect(badge).toHaveText('● 1');
			await appFrame(page, 'probe').locator('#boom').click();
			await expect(badge).toHaveText('● 2');
			await badge.click();
			await expect(window.locator('.mini-app-sheet pre')).toContainText('单位不对 {"value":3}');
			await expect(window.locator('.mini-app-sheet pre')).toContainText('算不出来：除以零');
			await window.locator('.mini-app-sheet button', { hasText: '让 AI 修' }).click();
			const input = page.locator('#side-ai .ai-input .ProseMirror');
			await expect(input).toContainText('小程序「探针」出错了，代码在 apps/probe/');
			await expect(input).toContainText('算不出来：除以零');
			// Cleared when it is loaded again.
			await window.locator('.mini-app-bar button', { hasText: '↻' }).click();
			await expect(badge).toHaveText('● 1');
		},
	);
});

test('a project app runs on its own development server, under the Studio’s address: `studio` works, a change shows, its output is kept', async ({ page }) => {
	test.setTimeout(90_000);
	await withApp(
		{
			'app.json': JSON.stringify({ name: '项目', icon: 'P', dev: { command: ['node', '../../node_modules/vite/bin/vite.js', '--port', '{port}', '--strictPort', '--base', '{base}'] } }),
			'index.html': '<!doctype html><html><head><title>项目</title></head><body><p id="out">…</p><script type="module" src="./main.js"></script></body></html>',
			'main.js': 'import { word } from "./word.js";\nstudio.article().then((a) => { document.querySelector("#out").textContent = word + " " + a.slug; });\n',
			'word.js': 'export const word = "一";\n',
		},
		async () => {
			await openStudio(page);
			await openApp(page, '项目');
			const window = page.locator('.mini-app-window[data-app="probe"]');
			await expect(window.locator('.mini-app-state')).toHaveText('运行中', { timeout: 60_000 });
			const frame = appFrame(page, 'probe');
			await expect(frame.locator('#out')).toHaveText(`一 ${slug}`);
			// Its own server sees the change, and the page (loaded again) keeps `studio`.
			writeFileSync(join(apps(), 'probe', 'word.js'), 'export const word = "二";\n');
			await expect(frame.locator('#out')).toHaveText(`二 ${slug}`, { timeout: 20_000 });
			await window.locator('.mini-app-log').click();
			await expect(window.locator('.mini-app-sheet pre')).toContainText('vite.js --port');
			await window.locator('.mini-app-sheet button', { hasText: '关闭' }).click();
			// Closed with its window? No: it runs on until the Studio's server stops; the window opened again finds it running.
			await window.locator('.mini-app-bar button', { hasText: '×' }).click();
			await openApp(page, '项目');
			await expect(frame.locator('#out')).toHaveText(`二 ${slug}`);
			const stopped = await page.evaluate(() => fetch('/api/studio/apps/probe/stop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json()));
			expect(stopped.state).toBe('stopped');
		},
	);
});

test('an app gives the articles a block: its page shows it, changes it in the article without loading again, and keeps its picture for the blog', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?', blocks: [{ fence: 'counter', entry: 'block.html', height: 200, title: '计数器' }] }),
			'app.html': '<p>窗口</p>',
			'block.html': [
				'<p id="n">…</p><button id="up">+1</button><script>',
				'let state = { n: 0 };',
				'studio.block.get().then((block) => { state = JSON.parse(block.state || "{\\"n\\":0}"); n.textContent = String(state.n); });',
				'up.onclick = async () => { state.n += 1; n.textContent = String(state.n); await studio.block.set(JSON.stringify(state)); await studio.block.picture(`<svg xmlns="http://www.w3.org/2000/svg"><text>${state.n}</text></svg>`); up.dataset.done = String(state.n); };',
				'</script>',
			].join(''),
		},
		async () => {
			appendToFixture('\n```counter\n{"n":1}\n```\n');
			await openStudio(page);
			const holder = editor(page).locator('.app-block');
			await holder.scrollIntoViewIfNeeded();
			const frame = page.frameLocator('.app-block-frame');
			await expect(frame.locator('#n')).toHaveText('1');
			// The same page all along: marked now, the mark still there after the block is changed.
			await frame.locator('body').evaluate(() => ((window as { mark?: string }).mark = 'same page'));
			await frame.locator('#up').click();
			await expect(frame.locator('#up')).toHaveAttribute('data-done', '2');
			expect(await frame.locator('body').evaluate(() => (window as { mark?: string }).mark)).toBe('same page');
			// Saved from the article (keys pressed in the frame are the app's).
			await editor(page).locator('p', { hasText: '结尾段落' }).click();
			await page.keyboard.press('ControlOrMeta+s');
			await expect(saveStatus(page)).toHaveText('已保存');
			expect(savedMarkdown()).toContain('```counter\n{"n":2}\n```');
			expect(fixtureHas(picturePath('counter', '{"n":2}'))).toBe(true);
			// Changed again: the picture of what it held before goes (to the trash), the new one is kept.
			await frame.locator('#up').click();
			await expect(frame.locator('#up')).toHaveAttribute('data-done', '3');
			await expect.poll(() => fixtureHas(picturePath('counter', '{"n":2}'))).toBe(false);
			expect(fixtureHas(picturePath('counter', '{"n":3}'))).toBe(true);
			// Its corner: in a window, or to the AI to change.
			await holder.hover();
			await holder.locator('.app-block-bar button', { hasText: 'AI' }).click();
			await expect(page.locator('#side-ai .ai-input .ProseMirror')).toContainText('改小程序「探针」（代码在 apps/probe/');
		},
	);
});

test('an app’s ⋯: its code to the AI (kept as it was first), a checkpoint kept by hand, and back to one', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?' }),
			'app.html': '<p id="out">第一版</p>',
		},
		async () => {
			await openStudio(page);
			await openApp(page, '探针');
			const window = page.locator('.mini-app-window[data-app="probe"]');
			const frame = appFrame(page, 'probe');
			await expect(frame.locator('#out')).toHaveText('第一版');
			const menu = async (label: string) => {
				await window.locator('.mini-app-more').click();
				await page.getByRole('menuitem', { name: label }).click();
			};
			await menu('存一个检查点');
			await expect(page.locator('.studio-toast', { hasText: '存好了：2 个文件' })).toBeVisible();
			// The AI changes it (here, by hand): a file changed, one made.
			writeFileSync(join(apps(), 'probe', 'app.html'), '<p id="out">第二版</p>');
			writeFileSync(join(apps(), 'probe', 'extra.js'), '1');
			await expect(frame.locator('#out')).toHaveText('第二版');
			await menu('回到检查点…');
			await window.locator('.mini-app-checkpoint', { hasText: '手动存的' }).getByRole('button', { name: '回到这里' }).click();
			await expect(frame.locator('#out')).toHaveText('第一版');
			expect(readFileSync(join(apps(), 'probe', 'app.html'), 'utf8')).toBe('<p id="out">第一版</p>');
			expect(existsSync(join(apps(), 'probe', 'extra.js'))).toBe(false);
			// Asked of the AI: its code kept first.
			await menu('让 AI 改这个…');
			await expect(page.locator('#side-ai .ai-input .ProseMirror')).toContainText('改小程序「探针」（代码在 apps/probe/');
			await menu('回到检查点…');
			await expect(window.locator('.mini-app-checkpoint').first()).toContainText('让 AI 改之前');
		},
	);
});

test('新建小程序: from a template, opened at once, the AI asked to write it; a React one runs on the repository’s Vite', async ({ page }) => {
	test.setTimeout(120_000);
	const made = ['probe-tool', 'probe-editor'];
	try {
		await openStudio(page);
		const create = async (name: string, template: string) => {
			await page.locator('#open-apps').click();
			await page.locator('#apps-new').click();
			await page.locator('#new-app-name').fill(name);
			await page.locator('#new-app-dialog').getByRole('radio', { name: new RegExp(template, 'u') }).click();
			await page.locator('#new-app-make').click();
		};
		await create('Probe Tool', '一页网页');
		await expect(appFrame(page, 'probe-tool').locator('h1')).toHaveText('Probe Tool');
		await expect(appFrame(page, 'probe-tool').locator('#article')).toHaveText('当前文章：Studio 测试夹具');
		await expect(page.locator('#side-ai .ai-input .ProseMirror')).toContainText('做小程序「Probe Tool」：已经从模板建好了，在 apps/probe-tool/');

		await create('Probe Editor', 'React');
		const window = page.locator('.mini-app-window[data-app="probe-editor"]');
		await expect(window.locator('.mini-app-state')).toHaveText('运行中', { timeout: 60_000 });
		await expect(appFrame(page, 'probe-editor').locator('h1')).toHaveText('Probe Editor');
		await expect(appFrame(page, 'probe-editor').locator('p')).toHaveText('当前文章：Studio 测试夹具');
	} finally {
		await page.evaluate(() => fetch('/api/studio/apps/probe-editor/stop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).catch(() => {});
		for (const id of made) rmSync(join(apps(), id), { recursive: true, force: true });
	}
});

test('⌘K finds commands after >: an app opened, or at a command it gives; making an app', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '?', commands: [{ id: 'convert', title: '换算一个数', entry: 'app.html#convert' }] }),
			'app.html': '<p id="out">…</p><script>const show = () => { out.textContent = location.hash || "首页"; }; show(); addEventListener("hashchange", show);</script>',
		},
		async () => {
			await openStudio(page);
			await page.keyboard.press('ControlOrMeta+k');
			await page.locator('#quick-find-input').fill('>探针');
			const rows = page.locator('#quick-find-dialog .finder-row, #quick-find-dialog [role="option"]');
			await expect(rows).toHaveText([/打开小程序「探针」/u, /探针：换算一个数/u]);
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('Enter');
			await expect(appFrame(page, 'probe').locator('#out')).toHaveText('#convert');
			await page.keyboard.press('ControlOrMeta+k');
			await page.locator('#quick-find-input').fill('> 新建小程序');
			await expect(rows).toHaveText([/新建小程序…/u]);
			await page.keyboard.press('Enter');
			await expect(page.locator('#new-app-dialog')).toBeVisible();
		},
	);
});

test('小程序 page: all of them as cards, found by a search; one opened fills the page, stays open when left, pops out to a window and back where it was', async ({ page }) => {
	await withApp(
		{
			'app.json': JSON.stringify({ name: '探针', icon: '◎', description: '测试整页打开' }),
			'app.html': '<p id="out">首页</p><button id="go" onclick="location.hash = \'#第二页\'">去第二页</button><script>const show = () => { out.textContent = decodeURIComponent(location.hash.slice(1)) || "首页"; }; show(); addEventListener("hashchange", show); window.loadedAt = Math.random();</script>',
		},
		async () => {
			await openStudio(page);
			await page.locator('#open-apps').click();
			// A page in the middle, as 全部文章 is: every app a card.
			await expect(page.locator('#apps-view')).toBeVisible();
			await expect(page.locator('.editor-panel')).toBeHidden();
			const probe = page.locator('.app-card[data-app-card="probe"]');
			await expect(probe).toContainText('测试整页打开');
			await expect(page.locator('.app-card[data-app-card="code-library"]')).toBeVisible();
			await page.locator('#apps-search').fill('整页');
			await expect(page.locator('.app-card')).toHaveCount(1);
			await page.locator('#apps-search').fill('');

			// Opened: the page is the app's, its address says so.
			await probe.locator('.app-card-open').click();
			const window = page.locator('.mini-app-window[data-app="probe"]');
			await expect(window).toHaveClass(/is-docked/u);
			await expect(page.locator('#apps-view .apps-stage')).toContainText('');
			expect(new URL(page.url()).searchParams.get('app')).toBe('probe');
			const frame = appFrame(page, 'probe');
			await frame.locator('#go').click();
			await expect(frame.locator('#out')).toHaveText('第二页');
			const loadedAt = await window.locator('iframe').evaluate((element: HTMLIFrameElement) => (element.contentWindow as Window & { loadedAt: number }).loadedAt);

			// Its ⋯ menu over it, not under it (clicked in first, as one does).
			await window.locator('.mini-app-title').click();
			await window.locator('.mini-app-more').click();
			const item = page.getByRole('menuitem').first();
			await expect(item).toBeVisible();
			const box = (await item.boundingBox())!;
			expect(await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x!, y!)?.closest('[role="menu"], [role="menuitem"]')), [box.x + 8, box.y + box.height / 2])).toBe(true);
			await page.keyboard.press('Escape');

			// ‹ 小程序: their list, it still open.
			await window.locator('.mini-app-back').click();
			await expect(probe).toContainText('打开着');
			await probe.locator('.app-card-open').click();
			await expect(frame.locator('#out')).toHaveText('第二页');
			// To an article and back: the app left open there, not loaded again; 小程序 again, their list.
			await page.locator('#article-list').getByText('Studio 测试夹具').first().click();
			await expect(page.locator('#apps-view')).toBeHidden();
			await page.locator('#open-apps').click();
			await expect(window).toBeVisible();
			await expect(frame.locator('#out')).toHaveText('第二页');
			await page.locator('#open-apps').click();
			await expect(probe).toBeVisible();
			await probe.locator('.app-card-open').click();
			expect(await window.locator('iframe').evaluate((element: HTMLIFrameElement) => (element.contentWindow as Window & { loadedAt: number }).loadedAt)).toBe(loadedAt);

			// 弹出: a window over the Studio, at the page it was at; 整页: the page again.
			await window.locator('.mini-app-switch').click();
			await expect(window).not.toHaveClass(/is-docked/u);
			await expect(page.locator('#mini-app-layer .mini-app-window[data-app="probe"]')).toBeVisible();
			await expect(frame.locator('#out')).toHaveText('第二页');
			await expect(page.locator('.app-card[data-app-card="probe"]')).toBeVisible();
			await window.locator('.mini-app-switch').click();
			await expect(window).toHaveClass(/is-docked/u);
			await expect(frame.locator('#out')).toHaveText('第二页');
			// Closed: the list again.
			await window.locator('.mini-app-bar button', { hasText: '×' }).click();
			await expect(page.locator('.app-card[data-app-card="probe"]')).not.toContainText('打开着');
		},
	);
});
