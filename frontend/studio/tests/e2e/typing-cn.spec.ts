import { expect, test, type Page } from '@playwright/test';

import { appendToFixture, editor, openStudio, paste, resetFixture } from './studio.ts';

// Typing in Chinese and pasting, as SiYuan takes them: the Markdown shortcuts as a Chinese input method
// types them, a shortcut or a menu pick a step of its own to undo, formulas copied from a page are
// formulas, Markdown a chat app copied as bare HTML is Markdown, and the toolbar waits for a selection
// to be made.

test.beforeEach(() => resetFixture());

/** A new empty line after the fixture's last paragraph. */
async function newLine(page: Page) {
	await openStudio(page);
	const last = editor(page).locator('p', { hasText: '结尾段落' });
	await last.scrollIntoViewIfNeeded();
	await last.click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
}

test('`》` at the start of a line is a quote, `【】` a to-do, `···` a code block', async ({ page }) => {
	await newLine(page);
	await page.keyboard.insertText('》');
	await page.keyboard.insertText('引的话');
	await expect(editor(page).locator('blockquote', { hasText: '引的话' })).toBeVisible();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');

	await page.keyboard.insertText('【');
	await page.keyboard.insertText('】');
	await page.keyboard.insertText('要做的事');
	// A to-do: an item with its box to tick.
	await expect(editor(page).locator('li', { hasText: '要做的事' }).getByRole('img')).toBeVisible();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');

	const codes = await editor(page).locator('.milkdown-code-block').count();
	await page.keyboard.insertText('···');
	await page.keyboard.type(' ');
	await expect(editor(page).locator('.milkdown-code-block')).toHaveCount(codes + 1);
});

test('`【【` asks for an article to link, as `[[` does', async ({ page }) => {
	await newLine(page);
	await page.keyboard.insertText('参见');
	await page.keyboard.insertText('【');
	await page.keyboard.insertText('【');
	await expect(page.locator('#quick-find-dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(editor(page).locator('p', { hasText: '参见' })).toHaveText('参见【【');
});

test('⌘Z after `# ` and a heading typed fast takes back the text, then the heading, not all at once', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('# 标题字');
	await expect(editor(page).locator('h1', { hasText: '标题字' })).toBeVisible();
	const headings = await editor(page).locator('h1').count();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(editor(page).locator('h1')).toHaveCount(headings);
	await expect(editor(page).getByText('标题字')).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(editor(page).locator('h1')).toHaveCount(headings - 1);
	await expect(editor(page).locator('p', { hasText: /^#$/u })).toHaveCount(1);
});

test('⌘Z after a slash menu pick gives back what was typed after the slash', async ({ page }) => {
	await newLine(page);
	await page.keyboard.type('/bt2');
	await page.waitForTimeout(100);
	await page.keyboard.press('Enter');
	await page.keyboard.type('第二节');
	await expect(editor(page).locator('h2', { hasText: '第二节' })).toBeVisible();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(editor(page).getByText('第二节')).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(editor(page).locator('p', { hasText: /^\/bt2$/u })).toHaveCount(1);
});

test('formulas copied from a page (KaTeX, MathML) come in as formulas', async ({ page }) => {
	await newLine(page);
	const katex = (tex: string, display: boolean) => {
		const inner = `<span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">drawn</span></span>`;
		return display ? `<span class="katex-display">${inner}</span>` : inner;
	};
	const wiki = '<span class="mwe-math-element"><math alttext="{\\displaystyle a^{2}+b^{2}}"><semantics><mrow><mi>a</mi></mrow></semantics></math><img class="mwe-math-fallback-image-inline" alt="a^2+b^2"></span>';
	await paste(page, {
		html: `<p>能量 ${katex('E=mc^2', false)} 守恒，又 ${wiki} 是和。</p><p>${katex('\\int_0^1 x\\,dx', true)}</p>`,
		text: '能量 E=mc2 守恒',
	});
	const line = editor(page).locator('p', { hasText: '守恒' });
	await expect(line.locator('.pm-inline-math')).toHaveCount(2);
	await expect(line).not.toContainText('drawn');
	await expect(editor(page).locator('.pm-display-math').last()).toContainText('∫');
});

test('Markdown copied from a chat app as bare HTML comes in as Markdown', async ({ page }) => {
	await newLine(page);
	const text = '## 小结\n\n- 第一点 **要紧**\n- 第二点';
	await paste(page, { html: `<div><span>## 小结</span><br><br><span>- 第一点 **要紧**</span><br><span>- 第二点</span></div>`, text });
	await expect(editor(page).locator('h2', { hasText: '小结' })).toBeVisible();
	await expect(editor(page).locator('li', { hasText: '第一点' }).locator('strong')).toHaveText('要紧');
});

test('the toolbar waits while text is being selected with the mouse, and shows once it is let go of', async ({ page }) => {
	appendToFixture('\n一段可以选的文字，长一点好拖。\n');
	await openStudio(page);
	const line = editor(page).getByText('一段可以选的文字，长一点好拖。', { exact: true });
	await line.scrollIntoViewIfNeeded();
	const box = (await line.boundingBox())!;
	const toolbar = page.locator('.milkdown-toolbar');
	await page.mouse.move(box.x + 4, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 8 });
	await page.waitForTimeout(150);
	await expect(toolbar).not.toHaveAttribute('data-show', 'true');
	await page.mouse.up();
	await expect(toolbar).toHaveAttribute('data-show', 'true');
});
