import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import rehypeStringify from 'rehype-stringify';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import remarkMathBrackets from '../plugins/remark-math-brackets.mjs';

type Node = { type: string; value?: string; children?: Node[]; data?: { hProperties?: { className?: string[] } } };

const parser = unified().use(remarkParse).use(remarkMath).use(remarkMathBrackets);

function tree(markdown: string): Node[] {
	return (parser.runSync(parser.parse(markdown)) as Node).children ?? [];
}

/** A compact picture of the blocks: text quoted, formulas as kind(value). */
function brief(node: Node): string {
	if (node.type === 'text') return JSON.stringify(node.value);
	if (node.type === 'inlineMath') {
		const display = node.data?.hProperties?.className?.includes('math-display');
		return `${display ? 'displayMath' : 'inlineMath'}(${node.value})`;
	}
	if (node.type === 'math') return `math(${node.value})`;
	return `${node.type}[${(node.children ?? []).map(brief).join(', ')}]`;
}

const blocks = (markdown: string) => tree(markdown).map(brief);

test('\\(…\\) is an inline formula, and Markdown leaves its insides alone', () => {
	assert.deepEqual(blocks('能量 \\(E = mc^2\\)，其中 \\(a_1 * b_2 * c_3\\) 不是斜体。'), [
		'paragraph["能量 ", inlineMath(E = mc^2), "，其中 ", inlineMath(a_1 * b_2 * c_3), " 不是斜体。"]',
	]);
});

test('\\[…\\] on its own lines splits the paragraph around a block formula', () => {
	const answer = 'Hartree–Fock 能量为\n\\[\nE_{HF} = \\sum_i h_{ii}\n\\]\n其中 \\(h\\) 是单电子算符。';
	assert.deepEqual(blocks(answer), [
		'paragraph["Hartree–Fock 能量为"]',
		'math(E_{HF} = \\sum_i h_{ii})',
		'paragraph["其中 ", inlineMath(h), " 是单电子算符。"]',
	]);
	assert.deepEqual(blocks('\\[ x^2 \\]'), ['math(x^2)']);
	assert.deepEqual(blocks('\\[a\\]\n\\[b\\]'), ['math(a)', 'math(b)']);
});

test('\\[…\\] inside a sentence stays in the line, drawn as display', () => {
	assert.deepEqual(blocks('句中 \\[x\\] 不拆。'), ['paragraph["句中 ", displayMath(x), " 不拆。"]']);
});

test('backslashes inside a formula stay LaTeX', () => {
	assert.deepEqual(blocks('\\(\\alpha \\\\ \\beta\\)'), ['paragraph[inlineMath(\\alpha \\\\ \\beta)]']);
	assert.deepEqual(blocks('\\(\\left( x \\right)\\)'), ['paragraph[inlineMath(\\left( x \\right))]']);
});

test('what is not a formula keeps its Markdown meaning', () => {
	assert.deepEqual(blocks('转义 \\\\(不是公式\\\\)'), ['paragraph["转义 \\\\(不是公式\\\\)"]']);
	assert.deepEqual(blocks('`\\(code\\)`'), ['paragraph[inlineCode[]]']);
	assert.deepEqual(blocks('未闭合 \\( a + b'), ['paragraph["未闭合 ( a + b"]']);
	assert.deepEqual(blocks('空的 \\(\\)'), ['paragraph["空的 ()"]']);
});

test('the nodes are the ones remark-math makes for dollars', () => {
	const strip = (nodes: Node[]) => JSON.stringify(nodes, (key, value) => (key === 'position' ? undefined : value));
	assert.equal(strip(tree('\\(a\\)')), strip(tree('$a$')));
	assert.equal(strip(tree('\\[\na\n\\]')), strip(tree('$$\na\n$$')));
});

test('formulas in lists and quotes', () => {
	assert.deepEqual(blocks('- 列表 \\(x_i\\)\n- \\[\n  y\n  \\]'), [
		'list[listItem[paragraph["列表 ", inlineMath(x_i)]], listItem[math(y)]]',
	]);
	assert.deepEqual(blocks('> 引用 \\(z\\)'), ['blockquote[paragraph["引用 ", inlineMath(z)]]']);
});

test('HTML carries the classes KaTeX rendering looks for', () => {
	const html = String(
		unified()
			.use(remarkParse)
			.use(remarkMath)
			.use(remarkMathBrackets)
			.use(remarkRehype)
			.use(rehypeStringify)
			.processSync('行内 \\(a\\)\n\\[\nb\n\\]\n句中 \\[c\\] 结束'),
	);
	assert.match(html, /<code class="language-math math-inline">a<\/code>/);
	assert.match(html, /<pre><code class="language-math math-display">b<\/code><\/pre>/);
	assert.match(html, /<code class="language-math math-display">c<\/code>/);
});

test('$$ written against its formula (as answers write it) is a block formula all the same; the text after it is text', () => {
	const answer = '设 $u = \\ln x$。\n\n$$\\begin{aligned}\n\\int \\ln x\\, dx &= x\\ln x - x + C\n\\end{aligned}$$\n\n验算一下。\n\n$$E = mc^2$$\n\n完。';
	assert.deepEqual(blocks(answer), [
		'paragraph["设 ", inlineMath(u = \\ln x), "。"]',
		'math(\\begin{aligned}\n\\int \\ln x\\, dx &= x\\ln x - x + C\n\\end{aligned})',
		'paragraph["验算一下。"]',
		'math(E = mc^2)',
		'paragraph["完。"]',
	]);
	// Opened on its own line, closed against its last.
	assert.deepEqual(blocks('$$\na + b\n= c$$\n\n后面。'), ['math(a + b\n= c)', 'paragraph["后面。"]']);
});

test('a $$ with nothing closing it, $$…$$ within a line, and code are left as they were', () => {
	// Never closed: as remark-math reads it (its label, then formula), as before.
	assert.deepEqual(blocks('$$ 是两美元，没有公式。\n下一行。'), ['math(下一行。)']);
	assert.deepEqual(blocks('行内 $$x$$ 留着。'), ['paragraph["行内 ", inlineMath(x), " 留着。"]']);
	assert.deepEqual(blocks('$$x$$ 后面还有字。'), ['paragraph[inlineMath(x), " 后面还有字。"]']);
	assert.deepEqual(blocks('```\n$$a$$\n```'), ['code[]']);
	assert.deepEqual(blocks('$$\na\n$$'), ['math(a)']);
});

test('a formula with its $$ against it keeps the places of the text: what follows it is where it was', () => {
	const answer = '前面。\n\n$$a\n= b$$\n\n后面。';
	const after = tree(answer).at(-1) as Node & { position: { start: { offset: number } } };
	assert.equal(answer.slice(after.position.start.offset), '后面。');
});

test('read by micromark’s development build too (the one the Studio’s pages load), which checks each token', () => {
	const script = `
		import remarkMath from 'remark-math';
		import remarkParse from 'remark-parse';
		import { unified } from 'unified';
		import remarkMathBrackets from ${JSON.stringify(new URL('../plugins/remark-math-brackets.mjs', import.meta.url).href)};
		const parser = unified().use(remarkParse).use(remarkMath).use(remarkMathBrackets);
		const tree = parser.runSync(parser.parse(process.argv[1]));
		console.log(tree.children.map((node) => node.type).join(','));
	`;
	const answer = '前面 \\(x\\)。\n\n$$\\begin{aligned}\na &= b \\\\\n&= c\n\\end{aligned}$$\n\n$$E = mc^2$$\n\n$$\nd\n$$\n\n$$ 两美元';
	const said = execFileSync(process.execPath, ['--conditions=development', '--input-type=module', '-e', script, answer], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' });
	assert.equal(said.trim(), 'paragraph,math,math,math,math');
});
