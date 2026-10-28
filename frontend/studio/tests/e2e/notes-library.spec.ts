import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, removeArticle, resetFixture, writeArticle, writeFixtureFile } from './studio.ts';

/** A file of another note than the fixture. */
function writeFileOf(folder: string, path: string, content: Buffer): void {
	writeFileSync(join(process.env.STUDIO_BLOG_DIR!, folder, path), content);
}

// 代码库 and 图片库 (apps/code-library, apps/image-library): what is scattered in all the notes, gathered by the Studio
// (studio.notes.*), shown at once, searched, and gone back to where it is.

const PLOT = readFileSync(new URL('./fixtures/plot.png', import.meta.url));
const frame = (page: Page, id: string) => page.frameLocator(`.mini-app-window[data-app="${id}"] iframe`);

async function openApp(page: Page, name: string): Promise<void> {
	await page.locator('#open-apps').click();
	await page.getByRole('menuitem', { name }).click();
}

test.beforeEach(() => {
	resetFixture();
	removeArticle('other-note');
});
test.afterEach(() => removeArticle('other-note'));

/** The test server's own: where it looks for repositories on "this machine", and where it keeps its own. */
const home = () => `${process.env.STUDIO_BLOG_DIR}-home`;
const ownRepos = () => `${process.env.STUDIO_BLOG_DIR}-repos`;

/** A git repository at `path`, its files written and committed. */
function repository(path: string, files: Record<string, string | Buffer>): void {
	for (const [name, content] of Object.entries(files)) {
		mkdirSync(join(path, name, '..'), { recursive: true });
		writeFileSync(join(path, name), content);
	}
	const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
	execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: path, env });
	execFileSync('git', ['add', '.'], { cwd: path, env });
	execFileSync('git', ['commit', '-q', '-m', '复现 GEDIIS'], { cwd: path, env });
}

test('代码仓库: repositories as GitHub shows them — one on this machine added, its README and files, a file read; one made here', async ({ page }) => {
	rmSync(home(), { recursive: true, force: true });
	rmSync(ownRepos(), { recursive: true, force: true });
	try {
		repository(join(home(), 'Code', 'optimizer'), {
			'README.md': '# optimizer\n\nGEDIIS 和 RFO 的复现。\n\n![曲线](docs/curve.png)\n\n见 [说明](docs/notes.md)。\n',
			'docs/curve.png': PLOT,
			'docs/notes.md': '# 说明\n\n先跑 `python src/opt.py`。\n',
			'src/opt.py': '# one RFO step\ndef rfo(g, H):\n    return -g\n',
		});
		writeFileSync(join(home(), 'Code', 'optimizer', 'src', 'opt.py'), '# one RFO step\ndef rfo(g, H):\n    return -g * 2\n');
		await openStudio(page);
		await openApp(page, '代码仓库');
		const app = frame(page, 'code-library');
		await expect(app.locator('#repos .r-empty')).toContainText('还没有仓库');

		// Found where repositories usually are, added.
		await app.locator('#repo-add').click();
		const found = app.locator('#repo-add-panel .r-found > div', { hasText: 'optimizer' });
		await expect(found).toContainText('Code/optimizer');
		await found.getByRole('button', { name: '添加' }).click();

		// Its home: what it is, its branch, its last commit, what is not committed; its files; its README.
		await expect(app.locator('.r-crumbs .here')).toHaveText('optimizer');
		await expect(app.locator('.r-about')).toContainText('GEDIIS 和 RFO 的复现。');
		await expect(app.locator('.r-about')).toContainText('分支 main');
		await expect(app.locator('.r-about')).toContainText('复现 GEDIIS');
		await expect(app.locator('.r-about')).toContainText('1 处 没提交的改动');
		await expect(app.locator('.r-files tr')).toHaveText([/docs/u, /src/u, /README\.md/u]);
		const picture = app.locator('.r-readme img[alt="曲线"]');
		await expect(picture).toBeVisible();
		expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

		// A folder, a file: its lines numbered, keywords and comments set apart.
		await app.locator('.r-files button', { hasText: 'src' }).click();
		await app.locator('.r-files button', { hasText: 'opt.py' }).click();
		await expect(app.locator('.r-box-head')).toContainText('Python · 3 行');
		await expect(app.locator('.r-code > span')).toHaveCount(3);
		await expect(app.locator('.r-code .c').first()).toHaveText('# one RFO step');
		await expect(app.locator('.r-code .k', { hasText: 'def' })).toHaveCount(1);
		await expect(app.locator('.r-code')).toContainText('return -g * 2');
		// Back by the path above it; a README's link to a file of it opens there.
		await app.locator('.r-crumbs button', { hasText: 'optimizer' }).click();
		await app.locator('.r-readme a', { hasText: '说明' }).click();
		await expect(app.locator('.r-crumbs .here')).toHaveText('notes.md');
		await expect(app.locator('.r-markdown')).toContainText('先跑 python src/opt.py。');

		// One made here: in the Studio's own repos/, with git and its README.
		await app.locator('.r-crumbs button', { hasText: '仓库' }).click();
		await app.locator('#repo-new').click();
		await app.locator('#repo-new-name').fill('ts-search');
		await app.locator('#repo-new-description').fill('找过渡态用的小脚本');
		await app.locator('#repo-new-panel').getByRole('button', { name: '新建' }).click();
		await expect(app.locator('.r-crumbs .here')).toHaveText('ts-search');
		await expect(app.locator('.r-about .r-tag')).toHaveText('Studio');
		await expect(app.locator('.r-readme')).toContainText('找过渡态用的小脚本');
		expect(execFileSync('git', ['-C', join(ownRepos(), 'ts-search'), 'rev-parse', '--is-inside-work-tree']).toString().trim()).toBe('true');

		// Both in the list; the one added taken off it, its folder left.
		await app.locator('.r-crumbs button', { hasText: '仓库' }).click();
		await expect(app.locator('.r-repo .r-name')).toHaveText(['ts-search', 'optimizer']);
		await app.locator('.r-search').fill('Python');
		await expect(app.locator('.r-repo')).toHaveCount(1);
		await app.locator('.r-search').fill('');
		await app.locator('.r-repo[data-repo] .r-name', { hasText: 'optimizer' }).click();
		page.once('dialog', (dialog) => void dialog.accept());
		await app.locator('#repo-remove').click();
		await expect(app.locator('.r-repo .r-name')).toHaveText(['ts-search']);
		expect(readFileSync(join(home(), 'Code', 'optimizer', 'README.md'), 'utf8')).toContain('optimizer');
	} finally {
		rmSync(home(), { recursive: true, force: true });
		rmSync(ownRepos(), { recursive: true, force: true });
	}
});

test('代码库: the code of every note, its scripts too, searched, filtered by language; the same code once; back to the note at it', async ({ page }) => {
	appendToFixture('\n## 复现\n\n```python title="RFO 一步"\nimport numpy as np\nstep = np.linalg.solve(H, -g)\n```\n\n```smiles\nCCO\n```\n');
	writeFixtureFile('ai/work/opt.py', 'def converged(g):\n    return abs(g).max() < 3e-4\n');
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n记一下：\n\n```bash\nxtb mol.xyz --opt\n```\n\n```python\nimport numpy as np\nstep = np.linalg.solve(H, -g)\n```\n');
	await openStudio(page);
	await openApp(page, '代码仓库');
	const app = frame(page, 'code-library');
	await app.locator('#tab-snippets').click();

	// Each piece once, the plugin's block (a molecule) not among them unless asked for.
	await expect(app.locator('.item')).toHaveCount(3);
	await expect(app.locator('#count')).toHaveText('3 段，来自 2 篇笔记');
	const rfo = app.locator('.item', { hasText: 'RFO 一步' });
	await expect(rfo).toContainText('出现在 2 篇');
	// Where it was last changed first.
	await expect(rfo.locator('.where')).toContainText('《另一篇笔记》');
	await expect(app.locator('.item', { hasText: 'opt.py' }).locator('.lang')).toHaveText('Python 文件');
	await app.locator('#others').check();
	await expect(app.locator('.item')).not.toHaveCount(3);
	await app.locator('#others').uncheck();

	// By language; by words of the code.
	await app.locator('.chip', { hasText: 'Shell' }).click();
	await expect(app.locator('.item')).toHaveCount(1);
	await expect(app.locator('.item')).toContainText('xtb mol.xyz --opt');
	await app.locator('.chip', { hasText: '全部' }).click();
	await app.locator('#query').fill('abs max');
	await expect(app.locator('.item')).toHaveCount(1);
	await expect(app.locator('.item mark').first()).toHaveText('abs');

	// Its whole text beside the list; where it is, each place one click away.
	await app.locator('#query').fill('');
	await rfo.click();
	await expect(app.locator('.detail .code')).toContainText('step = np.linalg.solve(H, -g)');
	await expect(app.locator('.place')).toHaveCount(2);
	await expect(app.locator('.place', { hasText: 'Studio 测试夹具' })).toContainText('› 复现');
	await app.locator('.place', { hasText: '另一篇笔记' }).click();
	await expect(page.locator('#article-title-input')).toHaveValue('另一篇笔记');
	await expect(editor(page).locator('.milkdown-code-block', { hasText: 'np.linalg.solve' })).toBeVisible();

	// A note changed: the list is asked again, by itself.
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n```fortran\nprogram hi\nend program\n```\n');
	await expect(app.locator('.item', { hasText: 'program hi' })).toBeVisible();
	await expect(app.locator('.item', { hasText: 'RFO 一步' })).not.toContainText('出现在 2 篇');
});

test('图片库: the pictures of every note on one wall, those never put in marked, the same picture once; large, and back to it in its note', async ({ page }) => {
	appendToFixture('\n## 结果\n\n![能量曲线](./img/curve.png)\n');
	writeFixtureFile('img/curve.png', PLOT);
	// The AI's copy of it, and a plot it made that no note shows.
	writeFixtureFile('ai/work/curve.png', PLOT);
	writeFixtureFile('ai/work/scratch.png', Buffer.concat([PLOT, Buffer.from([0])]));
	writeArticle('other-note', '---\ntitle: 另一篇笔记\npubDate: 2026-10-01\ndraft: true\n---\n\n很多段落，把图挤到下面。\n\n'.concat('一段话。\n\n'.repeat(60), '![同一张图](./curve.png)\n'));
	writeFileOf('other-note', 'curve.png', PLOT);
	await openStudio(page);
	await openApp(page, '图片库');
	const app = frame(page, 'image-library');

	// Shown in two notes, kept by the AI too: one picture, its three places.
	const curve = app.locator('.tile', { has: app.locator('.badge', { hasText: '3 处' }) });
	await expect(curve).toHaveCount(1);
	await expect(curve.locator('img')).toHaveJSProperty('complete', true);
	expect(await curve.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
	await expect(app.locator('.tile', { hasText: 'scratch.png' }).locator('.badges')).toContainText('没用上');
	await app.locator('.chip[data-use="unused"]').click();
	await expect(app.locator('.tile')).toHaveCount(1);
	await app.locator('.chip[data-use=""]').click();
	await app.locator('#query').fill('另一篇');
	await expect(app.locator('.tile')).toHaveCount(1);
	await app.locator('#query').fill('');

	// Large, with what it is and where; to the other note, at the picture, far down.
	await curve.click();
	await expect(app.locator('#viewer')).toBeVisible();
	await expect(app.locator('#facts')).toContainText('用在文章里');
	await expect(app.locator('#facts')).toContainText(/\d+ × \d+/u);
	await expect(app.locator('.place')).toHaveCount(3);
	await app.locator('.place', { hasText: '另一篇笔记' }).click();
	await expect(page.locator('#article-title-input')).toHaveValue('另一篇笔记');
	await expect(editor(page).locator('img[src*="curve.png"]')).toBeInViewport();
	await expect(page.locator('.search-flash')).toHaveCount(1);
});
