/**
 * Counting an article's Markdown: its words and its parts. Pure: no browser,
 * no Studio, so that it is tested on its own (test/count.test.ts).
 */

export type Stats = {
	/** Han characters in the running text (code, formulas, links' addresses and the front matter left out). */
	chinese: number;
	/** English words in the running text. */
	english: number;
	/** Minutes to read it, rounded up; 0 for an empty article. */
	minutes: number;
	headings: number;
	/** Display formulas: $$…$$ and \[…\]. */
	formulas: number;
	images: number;
	/** Fenced code blocks, every language (```job ones too). */
	codeBlocks: number;
	/** Of those, the ```job blocks (calculations). */
	jobBlocks: number;
};

/** Reading speeds, per minute. */
export const CHINESE_PER_MINUTE = 400;
export const ENGLISH_PER_MINUTE = 200;

const HAN = /\p{Script=Han}/gu;
const ENGLISH_WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/u;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/u;

/** Drops the YAML front matter at the top, if there is one. */
export function stripFrontMatter(markdown: string): string {
	const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/u.exec(markdown);
	return match ? markdown.slice(match[0].length) : markdown;
}

/** The running text of a line: what is not code, a formula, an image, a link's address or a tag. */
function plainText(line: string): string {
	return line
		.replace(/!\[[^\]]*\]\([^)]*\)(?:\{[^}]*\})?/gu, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
		.replace(/`[^`]*`/gu, ' ')
		.replace(/\$\$[^$]*\$\$/gu, ' ')
		.replace(/\$[^$\n]+\$/gu, ' ')
		.replace(/\\\([\s\S]*?\\\)/gu, ' ')
		.replace(/<[^>\n]+>/gu, ' ')
		.replace(/https?:\/\/\S+/gu, ' ');
}

export function countMarkdown(markdown: string): Stats {
	const stats: Stats = { chinese: 0, english: 0, minutes: 0, headings: 0, formulas: 0, images: 0, codeBlocks: 0, jobBlocks: 0 };
	let fence: { mark: string; length: number } | null = null;
	// Inside $$…$$ or \[…\] spread over lines: those lines are formula, not text.
	let display: '$$' | '\\]' | null = null;

	for (const raw of stripFrontMatter(markdown).split(/\r?\n/u)) {
		if (fence) {
			const closing = /^ {0,3}(`{3,}|~{3,})\s*$/u.exec(raw);
			if (closing && closing[1]![0] === fence.mark && closing[1]!.length >= fence.length) fence = null;
			continue;
		}
		const opening = FENCE.exec(raw);
		if (opening && display === null) {
			fence = { mark: opening[1]![0]!, length: opening[1]!.length };
			stats.codeBlocks += 1;
			if (opening[2] === 'job') stats.jobBlocks += 1;
			continue;
		}
		if (display) {
			if (display === '$$' ? raw.includes('$$') : raw.includes('\\]')) display = null;
			continue;
		}
		const line = raw.trim();
		// A display formula opens on a line of its own (it may close on the same line).
		if (line.startsWith('$$') || line.startsWith('\\[')) {
			stats.formulas += 1;
			const mark = line.startsWith('$$') ? '$$' : '\\]';
			const rest = line.slice(2);
			if (!rest.includes(mark)) display = mark;
			continue;
		}
		if (HEADING.test(raw)) stats.headings += 1;
		stats.images += (line.match(/!\[[^\]]*\]\([^)]*\)|<img\b/giu) ?? []).length;
		const text = plainText(raw.replace(/^ {0,3}#{1,6}[ \t]/u, ''));
		stats.chinese += (text.match(HAN) ?? []).length;
		stats.english += (text.match(ENGLISH_WORD) ?? []).length;
	}

	stats.minutes = readingMinutes(stats.chinese, stats.english);
	return stats;
}

/** Minutes to read this much, rounded up; nothing to read is 0. */
export function readingMinutes(chinese: number, english: number): number {
	const minutes = chinese / CHINESE_PER_MINUTE + english / ENGLISH_PER_MINUTE;
	return minutes > 0 ? Math.max(1, Math.ceil(minutes)) : 0;
}

/** One line of it, to put in an article: `全文 1,234 字 · 56 词 · 约 4 分钟`. */
export function statsLine(stats: Stats): string {
	const parts = [`全文 ${stats.chinese.toLocaleString('en-US')} 字`];
	if (stats.english) parts.push(`${stats.english.toLocaleString('en-US')} 词`);
	parts.push(stats.minutes ? `约 ${stats.minutes} 分钟` : '不到 1 分钟');
	return parts.join(' · ');
}
