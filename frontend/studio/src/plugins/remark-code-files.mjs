import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { visit } from 'unist-util-visit';

import { parseFenceMeta } from '../code-files/highlight.mjs';
import { codeFileLanguage } from '../code-files/languages.mjs';
import { codeFileBar, codeFileFigure, codeFileProblem, figureProperties, foldFor } from '../code-files/render.mjs';
import { parseScienceResourceRef } from '../science/parsers/resource-reference.ts';

/**
 * Code blocks as files, at build time:
 * - ```orca, ```incar, ```output and the other code-file languages are
 *   highlighted here (Shiki does not know them) and framed with a bar to
 *   copy or download them;
 * - a block whose only line is `@file ./assets/opt.log` shows that file of
 *   the article, its head and tail when long, or the lines `lines=a-b` names;
 * - any block with a `title="…"` gets the bar, and a long one folds.
 *
 * `skip` lists the fences other plugins draw (molecules); they are left alone.
 * @param {{ skip?: readonly string[] }} [options]
 */
export default function remarkCodeFiles({ skip = [] } = {}) {
	const skipped = new Set(['math', ...skip]);
	return (tree, file) => {
		const article = file.path ? dirname(file.path) : '';
		const slug = article ? basename(article) : '';
		visit(tree, 'code', (node, index, parent) => {
			if (!parent || index === undefined) return;
			const language = String(node.lang ?? '').toLowerCase();
			if (skipped.has(language)) return;
			const meta = parseFenceMeta(node.meta);
			const codeFile = codeFileLanguage(language);

			let reference;
			try {
				const ref = parseScienceResourceRef(node.value);
				reference = ref.kind === 'file' ? ref.path : undefined;
			} catch (error) {
				// Some other block that happens to start with `@file`.
				if (!codeFile) return;
				parent.children[index] = hast(codeFileProblem(language, error.message));
				file.message(error.message, node);
				return;
			}
			let fileText;
			if (reference) {
				if (!article) return;
				try {
					fileText = readFileSync(resolve(article, reference), 'utf8');
				} catch {
					const message = `找不到文件 ${reference}`;
					parent.children[index] = hast(codeFileProblem(language, message));
					file.message(message, node);
					return;
				}
			}
			const href = reference ? `/article-assets/${encodeURIComponent(slug)}/${reference.slice(2).split('/').map(encodeURIComponent).join('/')}` : '';

			if (codeFile) {
				const figure = codeFileFigure({
					language,
					meta,
					source: node.value,
					file: reference ? { path: reference, text: fileText, href } : undefined,
				});
				parent.children[index] = hast(figure);
				return;
			}

			// Shiki highlights the rest; a file's text, or the lines named, go in its place.
			if (reference) {
				const lines = fileText.replace(/\r?\n$/, '').split(/\r?\n/);
				node.value = meta.lines ? lines.slice(meta.lines.start - 1, meta.lines.end).join('\n') : lines.join('\n');
			}
			const lineCount = node.value.split('\n').length;
			const fold = foldFor(lineCount, meta);
			if (!meta.title && !reference && !fold) return;
			const bar = meta.title || reference
				? [hast(codeFileBar({ language, title: meta.title, path: reference ?? '', href }))]
				: [];
			parent.children[index] = {
				type: 'codeFileFrame',
				data: { hName: 'figure', hProperties: figureProperties(language, fold, bar.length ? [] : ['is-bare']) },
				children: [...bar, node],
			};
		});
	};
}

/** An mdast node that becomes `element` as it is. */
function hast(element) {
	return {
		type: 'codeFileHtml',
		data: { hName: element.tagName, hProperties: element.properties, hChildren: element.children },
	};
}
