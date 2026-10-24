/**
 * PaddleOCR's Markdown (its document parsing, `paddleocr api --model_type
 * doc_parsing --output_md`) as the notes write it (blog/AGENTS.md):
 *
 * - a display formula put on one line (` $$ … $$ `) on lines of its own;
 * - an inline formula with spaces inside its dollars (`$ \sin x $`) without them;
 * - a picture, an HTML `<img>` in a centred `<div>`, as a Markdown picture in
 *   `folder` with its width (`{width=69%}`), the caption under it (a centred
 *   line starting 图/Figure/Fig.) its words, without the number the blog adds;
 * - other centred lines as paragraphs;
 * - a table as a Markdown table, unless cells are joined (rowspan, colspan):
 *   that one stays the HTML it is.
 *
 * Returns the Markdown and the pictures it names (their file names in `imgs/`).
 */
export function fromPaddleMarkdown(text, { folder = './img/ocr/' } = {}) {
	const pictures = [];
	const blocks = String(text).replace(/\r\n?/gu, '\n').split(/\n{2,}/u).map((block) => block.trim()).filter(Boolean);
	const out = [];
	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index];
		const picture = /^(?:<div[^>]*>\s*)?<img\b[^>]*\bsrc=["']imgs\/([^"']+)["'][^>]*>(?:\s*<\/div>)?$/iu.exec(block);
		if (picture) {
			const name = picture[1];
			pictures.push(name);
			const width = /\bwidth=["']?(\d+(?:\.\d+)?%?)/iu.exec(block)?.[1];
			// The caption, a centred line right under it.
			const next = centred(blocks[index + 1] ?? '');
			const caption = next !== null && /^(?:图|Figure|Fig\.)\s*\d/iu.test(next) ? next.replace(/^(?:图|Figure|Fig\.)\s*\d+[.:：、]?\s*/iu, '') : null;
			if (caption !== null) index += 1;
			out.push(`![${inline(caption ?? '')}](${folder}${name})${width ? `{width=${width.endsWith('%') ? width : `${width}px`}}` : ''}`);
			continue;
		}
		const words = centred(block);
		if (words !== null) {
			out.push(inline(words));
			continue;
		}
		if (/^<table\b/iu.test(block)) {
			out.push(table(block) ?? block);
			continue;
		}
		const display = /^\$\$\s*([\s\S]*?)\s*\$\$$/u.exec(block);
		if (display) {
			out.push(`$$\n${display[1]}\n$$`);
			continue;
		}
		out.push(inline(block));
	}
	return { markdown: out.length ? `${out.join('\n\n')}\n` : '', pictures };
}

/** The words of a centred `<div>`, or null for any other block. */
function centred(block) {
	const match = /^<div\b[^>]*text-align:\s*center[^>]*>([\s\S]*?)<\/div>$/iu.exec(block);
	return match && !/<img\b/iu.test(match[1]) ? match[1].trim() : null;
}

/** Inline formulas without the spaces inside their dollars. */
function inline(text) {
	return text.replace(/(^|[^$\\])\$ +([^$\n]*?) +\$(?!\$)/gu, (_, before, formula) => `${before}$${formula}$`);
}

/** An HTML table as a Markdown table (its first row the head); null when cells are joined or it cannot be read. */
function table(html) {
	if (/\b(?:rowspan|colspan)\s*=/iu.test(html)) return null;
	const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)].map((row) =>
		[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/giu)].map((cell) => inline(cell[1].replace(/<br\s*\/?>/giu, ' ').replace(/<[^>]+>/gu, '').trim()).replace(/\|/gu, '\\|')),
	);
	if (!rows.length || rows.some((row) => row.length !== rows[0].length) || !rows[0].length) return null;
	const line = (cells) => `| ${cells.join(' | ')} |`;
	return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}
