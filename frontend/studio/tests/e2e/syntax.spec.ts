import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { parseMarkdownBodyBlocks, parseStudioDocument } from '../../src/studio/document/index.ts';
import { saveStatus } from './studio.ts';

// One block of each kind of Markdown an article may hold. A character typed
// into any block may change that block only: every other one is saved as
// it was written, byte for byte.

const SLUG = 'studio-syntax';
const MARK = 'Ж';
const fixture = fileURLToPath(new URL('./fixtures/syntax', import.meta.url));
const articleDir = (): string => join(process.env.STUDIO_BLOG_DIR!, SLUG);
const original = readFileSync(join(fixture, 'index.md'), 'utf8');

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/** What a block means, without where it sits or how it is spaced. */
function meaning(markdown: string): string {
	const strip = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(strip);
		if (!value || typeof value !== 'object') return value;
		return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'position' && key !== 'data').map(([key, child]) => [key, strip(child)]));
	};
	return JSON.stringify(strip((parser.parse(markdown) as { children: unknown[] }).children));
}

const blocks = (source: string) => parseMarkdownBodyBlocks(parseStudioDocument(source).body.raw);

/** Puts the caret at the end of the last text the author can type into, inside the `index`th top-level block. */
async function caretAtEndOf(page: Page, index: number): Promise<string | null> {
	return page.evaluate(async (index) => {
		const root = document.querySelector('.milkdown .ProseMirror')!;
		const block = [...root.children].filter((child) => !child.classList.contains('ProseMirror-widget'))[index];
		if (!block) return null;
		// Code blocks draw only the lines in view.
		block.scrollIntoView({ block: 'center' });
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				const parent = node.parentElement;
				if (!node.textContent?.trim() || !parent) return NodeFilter.FILTER_REJECT;
				const editable = parent.closest('[contenteditable]');
				return editable && editable.getAttribute('contenteditable') !== 'false' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
			},
		});
		let last: Text | null = null;
		while (walker.nextNode()) last = walker.currentNode as Text;
		if (!last) return null;
		(last.parentElement!.closest('[contenteditable="true"]') as HTMLElement).focus();
		const range = document.createRange();
		range.setStart(last, last.length);
		range.collapse(true);
		const selection = getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		return `${block.tagName.toLowerCase()}${block.className ? `.${String(block.className).split(' ')[0]}` : ''}: ${last.textContent!.trim().slice(-12)}`;
	}, index);
}

test.beforeEach(() => {
	rmSync(articleDir(), { recursive: true, force: true });
	cpSync(fixture, articleDir(), { recursive: true });
});
test.afterAll(() => rmSync(articleDir(), { recursive: true, force: true }));

test('the article opens with every block kept as written', async ({ page }) => {
	await page.addInitScript(() => { (window as { STUDIO_AUTOSAVE_DELAY?: number }).STUDIO_AUTOSAVE_DELAY = 300; });
	await page.goto(`/studio?article=${SLUG}`);
	await expect(saveStatus(page)).toHaveText('已载入');
	await expect(page.locator('#roundtrip-status')).toHaveText('Markdown 完整保留');
});

test('a character typed into a block changes that block only', async ({ page }) => {
	test.setTimeout(240_000);
	await page.addInitScript(() => { (window as { STUDIO_AUTOSAVE_DELAY?: number }).STUDIO_AUTOSAVE_DELAY = 300; });
	const before = blocks(original);
	const problems: string[] = [];
	let tried = 0;
	for (let index = 0; ; index += 1) {
		writeFileSync(join(articleDir(), 'index.md'), original);
		await page.goto(`/studio?article=${SLUG}`);
		await expect(saveStatus(page)).toHaveText('已载入');
		const where = await caretAtEndOf(page, index);
		if (where === null) {
			const count = await page.locator('.milkdown .ProseMirror > :not(.ProseMirror-widget)').count();
			if (index >= count) break;
			continue;
		}
		tried += 1;
		await page.keyboard.type(MARK);
		await expect(saveStatus(page)).toHaveText('已保存');
		const saved = readFileSync(join(articleDir(), 'index.md'), 'utf8');
		const after = blocks(saved);
		const changed = after.filter((block, at) => block.raw !== before[at]?.raw);
		const marked = changed.filter((block) => block.raw.includes(MARK));
		if (after.length !== before.length) {
			problems.push(`${where}\n  块数 ${before.length} → ${after.length}\n${saved}`);
		} else if (marked.length !== 1 || changed.length !== 1) {
			problems.push(`${where}\n  改动了 ${changed.length} 块：\n${changed.map((block) => `  ${JSON.stringify(block.raw)}`).join('\n')}`);
		} else {
			const at = after.indexOf(marked[0]);
			// The edited block is the author's own Markdown plus what was typed.
			if (marked[0].raw.replace(MARK, '') !== before[at].raw) {
				problems.push(`${where}\n  原文 ${JSON.stringify(before[at].raw)}\n  保存 ${JSON.stringify(marked[0].raw)}`);
			}
		}
	}
	expect(tried).toBeGreaterThan(10);
	expect(problems, problems.join('\n\n')).toEqual([]);
});
