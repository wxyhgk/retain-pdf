import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editFixture, editor, openStudio, resetFixture, saveStatus, savedMarkdown, slug } from './studio.ts';

// A long article is shown a part at a time (studio-editor.ts, as SiYuan shows a long document): its first part at
// once, the rest after, a part every other frame. Here a short one is too, in small parts (STUDIO_PARTS), so that a
// part ends next to every kind of block. What is shown at the end is what showing it whole shows, and what is typed
// while the rest comes in is saved, and nothing else.

/**
 * A stretch of an article with what the editor reads across blocks (a toggle, columns), blocks that run on, and what
 * the editor writes by where it is (an empty line).
 */
const section = (n: number) =>
	[
		`## 第 ${n} 节`,
		`第 ${n} 段，$x_{${n}}$ 在这里。`,
		// An empty line: written `<br />`, but for the last block.
		'<br />',
		'<details>\n<summary>展开</summary>\n\n里面的段落\n\n- 甲\n- 乙\n\n</details>',
		'<div class="columns">\n<div>\n\n左边\n\n</div>\n<div>\n\n右边\n\n</div>\n</div>',
		'- 一\n\n  续\n\n- 二\n  - 里',
		'* 星号的列表',
		'标题\n===',
		'```js\na\n\nb\n```',
		`$$\nk = ${n}\n$$`,
		'| a | b |\n|---|---|\n| 1 | 2 |',
		'> [!NOTE]\n> 提示',
		'1. 有序\n2. 列表',
		'<div>\n\nHTML 里的段落\n\n</div>',
	].join('\n\n');

const sections = (count: number) => Array.from({ length: count }, (_, index) => section(index + 1)).join('\n\n');

/** Opens the fixture with parts of these sizes, without waiting for all of it to be in. */
async function openInParts(page: Page, parts: { from: number; first?: number; rest?: number }): Promise<void> {
	await page.addInitScript((sizes) => {
		(window as { STUDIO_AUTOSAVE_DELAY?: number }).STUDIO_AUTOSAVE_DELAY = 600_000;
		(window as { STUDIO_PARTS?: object }).STUDIO_PARTS = sizes;
	}, parts);
	await page.goto(`/studio?article=${slug}`);
	await expect(editor(page)).toBeVisible();
}

/** The document the editor shows, without the empty paragraph it may keep last. */
const shownDocument = (page: Page) =>
	editor(page).evaluate((element) => {
		const doc = (element as unknown as { pmViewDesc: { node: { toJSON(): { content: Array<{ type: string; content?: unknown[] }> } } } }).pmViewDesc.node.toJSON();
		const last = doc.content.at(-1);
		if (last?.type === 'paragraph' && !last.content?.length) doc.content.pop();
		return doc;
	});

test.beforeEach(() => resetFixture());

test('an article shown a part at a time is the document shown whole', async ({ page }) => {
	appendToFixture(`\n${sections(10)}\n`);
	await openStudio(page);
	const whole = await shownDocument(page);
	const second = await page.context().newPage();
	// Parts of a block or two: each block is the last of a part once.
	await openInParts(second, { from: 0, first: 1, rest: 1 });
	await expect(saveStatus(second)).toHaveText('已载入', { timeout: 60_000 });
	await expect(editor(second)).toHaveClass(/\bis-long\b/u);
	await expect(second.locator('[aria-busy="true"]')).toHaveCount(0);
	expect(await shownDocument(second)).toEqual(whole);
	// And written back as it is (whole, all of the fixture is: as it was written).
	await expect(page.locator('#roundtrip-status')).toHaveAttribute('data-state', 'exact');
	await expect(second.locator('#roundtrip-status')).toHaveAttribute('data-state', 'exact');
});

test('what is typed while the rest of the article comes in is saved, and nothing else', async ({ page }) => {
	test.setTimeout(120_000);
	// Long enough to take seconds to come in.
	appendToFixture(`\n${sections(100)}\n`);
	const before = savedMarkdown();
	await openInParts(page, { from: 0, first: 300, rest: 150 });
	const first = editor(page).locator('h2', { hasText: '第 1 节' });
	await first.click();
	await page.keyboard.press('End');
	await expect(page.locator('[aria-busy="true"]')).toHaveCount(1);
	await page.keyboard.type('甲');
	await expect(editor(page).locator('h2', { hasText: '第 100 节' })).toBeVisible({ timeout: 60_000 });
	await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
	await page.keyboard.type('乙');
	await page.keyboard.press('ControlOrMeta+s');
	await expect(saveStatus(page)).toHaveText('已保存');
	expect(savedMarkdown()).toBe(before.replace('## 第 1 节\n', '## 第 1 节甲乙\n'));
	// The rest came in after what was typed, in order.
	await expect(editor(page).locator('> h2')).toHaveCount(100);
});

test('an empty line at the end of a part is written back as it was', async ({ page }) => {
	// Parts of about 11 characters: 后 and the empty line after it make one, the empty line last, and last in the
	// editor too as it comes in (nothing after the first part makes the editor keep an empty line of its own last).
	editFixture((markdown) => `${/^---\n[\s\S]*?\n---\n/u.exec(markdown)![0]}\n前\n\n后\n\n<br />\n\n再后\n\n最后\n`);
	await openInParts(page, { from: 0, first: 1, rest: 11 });
	await expect(saveStatus(page)).toHaveText('已载入');
	await expect(page.locator('#roundtrip-status')).toHaveAttribute('data-state', 'exact');
});
