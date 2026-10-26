import assert from 'node:assert/strict';
import test from 'node:test';

import { insertBelowImage } from './image-insert.mjs';

test('what was read goes under the paragraph the picture is in, set off by blank lines', () => {
	const source = '---\ntitle: a\n---\n\n前面。\n\n![式 1](./img/eq.png)\n图下的说明\n\n后面。\n';
	assert.equal(insertBelowImage(source, './img/eq.png', '$$\nE = mc^2\n$$'), '---\ntitle: a\n---\n\n前面。\n\n![式 1](./img/eq.png)\n图下的说明\n\n$$\nE = mc^2\n$$\n\n后面。\n');
});

test('the picture at the end of the article; written with or without ./; with a size after it', () => {
	assert.equal(insertBelowImage('![](img/eq.png)', './img/eq.png', 'x'), '![](img/eq.png)\n\nx\n');
	assert.equal(insertBelowImage('![](./img/eq.png){width=60%}\n', 'img/eq.png', 'x'), '![](./img/eq.png){width=60%}\n\nx\n');
	assert.equal(insertBelowImage('![](./img/eq.png "标题")\n\n\n\n下文', './img/eq.png', '\nx\n\n'), '![](./img/eq.png "标题")\n\nx\n\n下文');
});

test('only the first place the picture is shown; a picture not in the article is said so', () => {
	assert.equal(insertBelowImage('![](./a.png)\n\n![](./a.png)\n', './a.png', 'x'), '![](./a.png)\n\nx\n\n![](./a.png)\n');
	assert.equal(insertBelowImage('![](./img/other.png)\n', './img/eq.png', 'x'), null);
	// Another picture whose name starts the same is not it.
	assert.equal(insertBelowImage('![](./img/eq.png.bak)\n', './img/eq.png', 'x'), null);
});
