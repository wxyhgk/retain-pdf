import assert from 'node:assert/strict';
import test from 'node:test';
import { Schema } from 'prosemirror-model';

import { filesNamed, headingSection } from '../src/studio/editor/split-section.ts';

const schema = new Schema({
	nodes: {
		doc: { content: 'block+' },
		paragraph: { group: 'block', content: 'text*' },
		heading: { group: 'block', content: 'text*', attrs: { level: { default: 1 } } },
		text: {},
	},
});
const p = (text: string) => schema.nodes.paragraph.create(null, schema.text(text));
const h = (level: number, text: string) => schema.nodes.heading.create({ level }, schema.text(text));

test('a heading’s section runs to the next heading as high or higher, past lower ones', () => {
	const doc = schema.nodes.doc.create(null, [p('前言'), h(2, '方法'), p('甲'), h(3, '细节'), p('乙'), h(2, '结果'), p('丙')]);
	const at: number[] = [];
	doc.forEach((node, offset) => at.push(offset));
	const section = headingSection(doc, at[1]!)!;
	assert.equal(section.title, '方法');
	assert.equal(doc.textBetween(section.from, section.to, '|'), '方法|甲|细节|乙');
	assert.equal(doc.textBetween(headingSection(doc, at[5]!)!.from, headingSection(doc, at[5]!)!.to, '|'), '结果|丙');
	assert.equal(headingSection(doc, at[0]!), null, 'not a heading');
});

test('the files a piece of Markdown names in the article’s folders', () => {
	assert.deepEqual(filesNamed('![图](./img/plot%201.png){width=60%}\n\n```log\n@file ./assets/opt.log\n```\n[外](https://x.org/img/a.png)'), ['img/plot 1.png', 'assets/opt.log']);
});
