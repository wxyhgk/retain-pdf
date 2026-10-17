import assert from 'node:assert/strict';
import test from 'node:test';

import { addSearchWords, pinyinWords } from '../src/studio/editor/slash-search.ts';

test('a Chinese name is found by its pinyin, whole and by initials', () => {
	assert.deepEqual(pinyinWords('代码'), ['daima', 'dm']);
	assert.deepEqual(pinyinWords('标题 1'), ['biaoti1', 'bt1']);
	// Words with more than one reading are read as the name has them.
	assert.deepEqual(pinyinWords('提示块'), ['tishikuai', 'tsk']);
	assert.deepEqual(pinyinWords('折叠块'), ['zhediekuai', 'zdk']);
	assert.deepEqual(pinyinWords('有序列表'), ['youxuliebiao', 'yxlb']);
});

test('a name without Chinese has no pinyin', () => {
	assert.deepEqual(pinyinWords('SMILES'), []);
});

test('every item gets its pinyin, and Crepe’s own items their English names', () => {
	const groups = [
		{ key: 'text', items: [{ key: 'h2', label: '标题 2' as string, keywords: undefined as string[] | undefined }] },
		{ key: 'notion', items: [{ key: 'callout', label: '提示块', keywords: ['callout'] }] },
		// An item of the Studio's own under a key Crepe also uses takes none of Crepe's words.
		{ key: 'science', items: [{ key: 'code', label: '化学 SMILES', keywords: ['smiles'] }] },
	];
	addSearchWords({ build: () => groups });
	assert.deepEqual(groups[0].items[0].keywords, ['h2', 'heading2', 'biaoti2', 'bt2']);
	assert.deepEqual(groups[1].items[0].keywords, ['callout', 'tishikuai', 'tsk']);
	assert.deepEqual(groups[2].items[0].keywords?.slice(0, 1), ['smiles']);
	assert.ok(!groups[2].items[0].keywords?.includes('snippet'));
});
