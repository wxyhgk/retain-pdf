import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import { locale, matchLocale, registerLocale, setLocale, setLocaleResolver, t } from '../index.mjs';
import { translatable, untranslated } from '../scan.mjs';
import { readWords, studioSources } from '../sources.mjs';

const projectRoot = resolve(import.meta.dirname, '../../..');

/**
 * The Studio's code that is in the language chosen: no Chinese left outside t(). Each part is added here as its words
 * are given to t(), until it is all of it.
 */
const DONE = [/^src\/studio\/shell\/dialogs\/LocaleDialog\.tsx$/u, /^src\/studio\/server\/locale-settings\.mjs$/u, /^src\/studio\/server\/routes\/settings\.mjs$/u];

test('t: the Chinese as written, its {names} given', () => {
	setLocale('zh-CN');
	assert.equal(t('已移动到 {path}', { path: 'img/a.png' }), '已移动到 img/a.png');
	assert.equal(t('第 {n} 页，共 {n} 页', { n: 3 }), '第 3 页，共 3 页');
	assert.equal(t('用 {prompt} 问', {}), '用 {prompt} 问', 'a {name} not given stays');
});

test('t: another language, a word it lacks staying Chinese', () => {
	registerLocale('xx', 'Test', { '已移动到 {path}': 'Moved to {path}' });
	setLocale('xx');
	try {
		assert.equal(locale(), 'xx');
		assert.equal(t('已移动到 {path}', { path: 'a' }), 'Moved to a');
		assert.equal(t('没有翻译'), '没有翻译');
		setLocaleResolver(() => 'zh-CN');
		assert.equal(t('已移动到 {path}', { path: 'a' }), '已移动到 a', "the request's language over the page's");
	} finally {
		setLocaleResolver(null);
		setLocale('zh-CN');
	}
});

test('matchLocale: whole id, then the language alone, else Chinese', () => {
	registerLocale('en', 'English', {});
	assert.equal(matchLocale(['en-GB', 'zh-CN']), 'en');
	assert.equal(matchLocale(['fr', 'zh-TW']), 'zh-CN');
	assert.equal(matchLocale(['fr']), 'zh-CN');
});

test('scan: t() arguments, and Chinese outside t()', () => {
	const source = [
		"const a = t('保存');",
		"const b = '没翻译';",
		"// 注释里的中文不算",
		"const c = /中文|'/u.test(x) ? t('引号\\'里') : '';",
		"const d = '正文'; // i18n-ignore",
	].join('\n');
	assert.deepEqual(translatable(source), ['保存', "引号'里"]);
	assert.deepEqual(untranslated(source), [{ line: 2, text: '没翻译' }]);
	const jsx = "const e = () => <p title={t('提示')}>文字<b>{t('好')}</b></p>;";
	assert.deepEqual(untranslated(jsx, { jsx: true }), [{ line: 1, text: '文字' }]);
	assert.throws(() => translatable('t(`第 ${n} 页`)'));
});

test("the Studio's parts done have no Chinese left outside t()", async () => {
	const left: string[] = [];
	for (const path of await studioSources(projectRoot)) {
		if (!DONE.some((done) => done.test(path))) continue;
		for (const piece of (await readWords(projectRoot, path)).untranslated) left.push(`${path}:${piece.line} ${piece.text}`);
	}
	assert.deepEqual(left, []);
});
