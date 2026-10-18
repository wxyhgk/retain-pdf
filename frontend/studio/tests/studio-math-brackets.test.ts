import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeMarkdownBody } from '../src/studio/document/merge.ts';

test('Studio keeps the author\'s \\( \\) and \\[ \\] when the editor writes dollars back', () => {
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
