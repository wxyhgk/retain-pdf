import assert from 'node:assert/strict';
import test from 'node:test';

import { countMarkdown, readingMinutes, statsLine, stripFrontMatter } from '../count.ts';

test('Chinese characters and English words are counted in the running text only', () => {
	const stats = countMarkdown('你好，世界。Hello world, it\'s well-known.\n\n再来一行 `代码里的中文` 和 $公式$ 以及 [链接文字](https://example.com/路径) 结束。\n');
	// 你好世界 + 再来一行 + 和 + 以及 + 链接文字 + 结束
	assert.equal(stats.chinese, 4 + 4 + 1 + 2 + 4 + 2);
	// Hello, world, it's, well-known
	assert.equal(stats.english, 4);
});

test('the front matter, code, formulas and images do not count as text', () => {
	const stats = countMarkdown([
		'---', "title: '标题标题'", 'tags: []', '---', '',
		'正文。',
		'```python', '# 不是标题', 'print("你好 world")', '```',
		'$$', '\\sum_i 公式 x_i', '$$',
		'\\[', 'a + b', '\\]',
		'![图里的字](img/a.png){width=50%}',
		'',
	].join('\n'));
	assert.equal(stats.chinese, 2);
	assert.equal(stats.english, 0);
	assert.equal(stats.headings, 0);
	assert.equal(stats.codeBlocks, 1);
	assert.equal(stats.formulas, 2);
	assert.equal(stats.images, 1);
});

test('headings, job blocks, and fences that nest or use ~~~ are told apart', () => {
	const stats = countMarkdown([
		'# 一级', '## Second level', '#不是标题', '',
		'````md', '```job', '# 里面', '```', '````', '',
		'```job id=a program=xtb', 'x', '```', '',
		'~~~', 'tilde', '~~~', '',
	].join('\n'));
	assert.equal(stats.headings, 2);
	assert.equal(stats.codeBlocks, 3);
	assert.equal(stats.jobBlocks, 1);
	// The headings' words count; a heading's `#` is not a word, and `#不是标题` is text.
	assert.equal(stats.chinese, 2 + 4);
	assert.equal(stats.english, 2);
});

test('a one-line $$…$$ formula and a plain $ price are not mixed up', () => {
	const stats = countMarkdown('$$ E = mc^2 $$\n\n花了 5 元，或者 $x$ 美元。\n\n$$\na\n$$\n\n再来一段。\n');
	assert.equal(stats.formulas, 2);
	// 花了 元 或者 美元 (7), 再来一段 (4); the numbers and $x$ are not text.
	assert.equal(stats.chinese, 11);
	assert.equal(stats.english, 0);
});

test('reading time: rounded up, at least a minute for anything, none for nothing', () => {
	assert.equal(readingMinutes(0, 0), 0);
	assert.equal(readingMinutes(1, 0), 1);
	assert.equal(readingMinutes(400, 0), 1);
	assert.equal(readingMinutes(401, 0), 2);
	assert.equal(readingMinutes(400, 200), 2);
	assert.equal(countMarkdown('').minutes, 0);
});

test('the front matter is cut only at the very top', () => {
	assert.equal(stripFrontMatter('---\na: 1\n---\n正文'), '正文');
	assert.equal(stripFrontMatter('正文\n---\na: 1\n---\n'), '正文\n---\na: 1\n---\n');
	assert.equal(stripFrontMatter('---\r\na: 1\r\n---\r\n正文'), '正文');
});

test('the line to put in an article', () => {
	assert.equal(statsLine(countMarkdown('你'.repeat(1234) + ' hello world')), '全文 1,234 字 · 2 词 · 约 4 分钟');
	assert.equal(statsLine(countMarkdown('')), '全文 0 字 · 不到 1 分钟');
});
