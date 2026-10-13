import assert from 'node:assert/strict';
import test from 'node:test';

import rehypeStringify from 'rehype-stringify';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import remarkMathBrackets from '../src/plugins/remark-math-brackets.mjs';

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

test('Studio keeps the author\'s \\( \\) and \\[ \\] when the editor writes dollars back', async () => {
	const { mergeMarkdownBody } = await import('../src/studio/document/merge.ts');
	const original = '能量 \\(E = mc^2\\) 的推导：\n\n\\[\nE_{HF} = \\sum_i h_{ii}\n\\]\n\n结束。\n';
	const fromEditor = '能量 $E = mc^2$ 的推导：\n\n$$\nE_{HF} = \\sum_i h_{ii}\n$$\n\n结束。\n';
	const unchanged = mergeMarkdownBody(original, fromEditor);
	assert.equal(unchanged.body, original);
	assert.equal(unchanged.changedBlocks, 0);
	const edited = mergeMarkdownBody(original, fromEditor.replace('结束。', '完。'));
	assert.match(edited.body, /能量 \\\(E = mc\^2\\\)/);
	assert.match(edited.body, /\\\[\nE_\{HF\}/);
	assert.match(edited.body, /完。/);
	assert.equal(edited.changedBlocks, 1);
	const inSentence = '句中的展示公式 \\[\\int_0^1 x\\,dx\\] 留在行内。\n';
	assert.equal(mergeMarkdownBody(inSentence, '句中的展示公式 $\\int_0^1 x\\,dx$ 留在行内。\n').body, inSentence);
});
