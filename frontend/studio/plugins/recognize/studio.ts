import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/ui.ts';

/**
 * The Studio: 识别 — what a picture in an article can be read as by the large model of AI 设置: a
 * formula into LaTeX, text into paragraphs, a table into a Markdown table, a drawn molecule into
 * SMILES. A picture's menu has 「识别…」, which lists them; what is read is put under the picture,
 * to accept or not. Another kind is another `ctx.recognizers.register` (here, or in a plugin of its own).
 */
export const name = 'recognize';
export const description = '识别图片：图片菜单里的「识别…」，用 AI 设置里的大模型把图里的公式读成 LaTeX、文字读成段落、表格读成 Markdown 表格、分子结构读成 SMILES，放在图下面，逐处接受或拒绝。';
export const inject = ['recognizers'];

/** An answer of several lines inside one fence or one display formula, as the blog draws them. */
const fence = (opening: string, closing: string) => (answer: string) => `${opening}\n${answer.trim()}\n${closing}`;

export function apply(ctx: Context): void {
	ctx.recognizers.register({
		id: 'recognize.formula',
		label: '公式 → LaTeX',
		prompt: [
			'Transcribe the mathematical formula in the picture into LaTeX that KaTeX renders.',
			'Write only the LaTeX, without $, $$, \\[ or \\( around it.',
			'Several equations: put them in one aligned environment, one per line, separated by \\\\.',
			'Keep every symbol, subscript, superscript and accent as drawn; use \\mathrm for upright words and units.',
		].join(' '),
		toMarkdown: fence('$$', '$$'),
	});
	ctx.recognizers.register({
		id: 'recognize.text',
		label: '文字 → 段落',
		prompt: [
			'Transcribe all the text in the picture as Markdown, in the language it is written in.',
			'Join lines that the layout broke; keep paragraphs, headings, lists and emphasis as they are.',
			'Write formulas inside the text as $…$ (inline) or $$…$$ (on their own).',
		].join(' '),
	});
	ctx.recognizers.register({
		id: 'recognize.table',
		label: '表格 → Markdown 表格',
		prompt: [
			'Transcribe the table in the picture as one GitHub-flavored Markdown table: the header row first, then the rows, every cell as written.',
			'Merged cells: repeat their content in each cell they cover. Formulas in cells as $…$.',
			'Only the table, nothing before or after it.',
		].join(' '),
	});
	ctx.recognizers.register({
		id: 'recognize.molecule',
		label: '分子结构 → SMILES',
		prompt: [
			'The picture shows a chemical structure. Write the canonical SMILES of the molecule drawn, with stereochemistry where the drawing shows it.',
			'Several molecules: one SMILES, the molecules joined by a dot.',
			'Only the SMILES.',
		].join(' '),
		toMarkdown: fence('```smiles', '```'),
	});
}
