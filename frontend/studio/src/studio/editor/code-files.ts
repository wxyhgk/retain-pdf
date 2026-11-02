import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';

import { enhanceCodeFiles } from '@blog/markdown/code-files/browser.ts';
import { downloadName, parseFenceMeta } from '@blog/markdown/code-files/highlight.mjs';
import { codeFileLanguages } from '@blog/markdown/code-files/languages.mjs';
import { codeFileProblem, type HastChild, type HastElement } from '@blog/markdown/code-files/render.mjs';
import '@blog/markdown/code-files/code-files.css';
import { parseScienceResourceRef } from '@blog/science/parsers/resource-reference.ts';
import type { ArticleFileDropHost } from './file-drop.ts';
import { isFormulaBlock } from '@blog/editor-kit/math/formula-block.ts';
import { t } from '@blog/i18n/index.mjs';

/** The code-file languages for CodeMirror, coloured by the parsers the blog uses. */
export const codeFileLanguageDescriptions: LanguageDescription[] = codeFileLanguages.map((language) =>
	LanguageDescription.of({
		name: language.name,
		alias: [...language.aliases],
		extensions: [...language.extensions],
		filename: language.names.length ? new RegExp(`^(?:${language.names.join('|')})$`, 'i') : undefined,
		support: new LanguageSupport(StreamLanguage.define(language.parser)),
	}),
);

/** The file a block shows, when its only line is `@file ./assets/…`; undefined otherwise or when malformed. */
export function codeFileReference(source: string): string | undefined {
	try {
		const reference = parseScienceResourceRef(source);
		return reference.kind === 'file' ? reference.path : undefined;
	} catch {
		return undefined;
	}
}

function toDom(node: HastChild): Node {
	if (node.type === 'text') return document.createTextNode(node.value);
	const element = document.createElement(node.tagName);
	for (const [key, value] of Object.entries(node.properties)) {
		if (value === undefined || value === null || value === false) continue;
		const name = key === 'className'
			? 'class'
			: key === 'tabIndex'
				? 'tabindex'
				: /^data[A-Z]/.test(key)
					? `data-${key.slice(4).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '')}`
					: key;
		element.setAttribute(name, Array.isArray(value) ? value.join(' ') : String(value));
	}
	for (const child of node.children) element.append(toDom(child));
	return element;
}

function draw(figure: HastElement): HTMLElement {
	return toDom(figure) as HTMLElement;
}

/**
 * Wires the copy, download and unfold of the code files that previews put
 * under `root`: Crepe copies a preview in as HTML, so a preview's own
 * listeners would not survive.
 */
export function observeCodeFiles(root: HTMLElement): () => void {
	const observer = new MutationObserver(() => enhanceCodeFiles(root));
	observer.observe(root, { childList: true, subtree: true });
	return () => observer.disconnect();
}

/**
 * The preview of a code block that shows a file of the article: the file as
 * the blog draws it, drawn by the server (`figure`), which sends only the
 * lines shown. Other blocks have none (null), so they stay editable code.
 */
export function codeFilePreview(
	figure: (reference: string, language: string, meta: string) => Promise<HastElement>,
): (language: string, content: string, apply: (value: HTMLElement) => void, meta: string) => HTMLElement | null | undefined {
	return (language, content, apply, meta) => {
		const path = codeFileReference(content);
		if (!path) return null;
		figure(path, language, meta).then(
			(drawn) => apply(editable(draw(drawn), path, language, meta)),
			(error: unknown) => apply(draw(codeFileProblem(language, error instanceof Error ? error.message : t('找不到文件 {path}', { path })))),
		);
		return undefined;
	};
}

/** A code file's path in the article, as its preview says it (`./assets/opt.py` → `assets/opt.py`). */
export function codeFilePath(figure: Element): string | null {
	return (figure as HTMLElement).dataset.filePath ?? null;
}

/**
 * The preview of a file in the Studio: which file it is (for 编辑 and a double-click: file-editor.ts, wired in
 * studio-editor.ts), and an 编辑 among its actions. On the blog it stays as drawn.
 */
function editable(figure: HTMLElement, reference: string, language: string, meta: string): HTMLElement {
	Object.assign(figure.dataset, { filePath: reference.replace(/^\.\//u, ''), fileLanguage: language, fileMeta: meta });
	figure.title = t('双击编辑这个文件');
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'code-file-edit';
	button.dataset.codeAction = 'edit';
	button.textContent = t('编辑');
	figure.querySelector('.code-file-actions')?.prepend(button);
	return figure;
}

/** The previews of `path` under `root` drawn again (the file was changed): as the server draws it now. */
export function redrawCodeFiles(root: ParentNode, path: string, figure: (reference: string, language: string, meta: string) => Promise<HastElement>): void {
	for (const shown of root.querySelectorAll<HTMLElement>('figure.code-file[data-file-path]')) {
		if (shown.dataset.filePath !== path) continue;
		const { fileLanguage = '', fileMeta = '' } = shown.dataset;
		void figure(`./${path}`, fileLanguage, fileMeta).then((drawn) => shown.replaceWith(editable(draw(drawn), `./${path}`, fileLanguage, fileMeta)), () => {});
	}
}

/** Whether a block can be saved as a file: code, not a formula, not already a file. */
export function canSaveAsFile(node: ProseNode): boolean {
	return node.type.name === 'code_block' && !isFormulaBlock(node) && Boolean(node.textContent.trim()) && !codeFileReference(node.textContent);
}

/**
 * Saves a code block's text as a file in the article (`assets/`, named by
 * its title or its language) and leaves `@file ./assets/…` in its place, so
 * the blog shows the file and offers it for download.
 */
export function saveCodeBlockAsFile(host: ArticleFileDropHost): (view: EditorView, pos: number) => Promise<void> {
	return async (view, pos) => {
		const node = view.state.doc.nodeAt(pos);
		if (!node || !canSaveAsFile(node)) return;
		const language = String(node.attrs.language ?? '');
		const name = downloadName(language, parseFenceMeta(node.attrs.meta).title, '');
		const file = new File([`${node.textContent}\n`], name, { type: 'text/plain' });
		let path: string;
		try {
			[path] = await host.upload([file]);
		} catch (error) {
			host.report(error instanceof Error ? error.message : t('保存文件失败'), true);
			return;
		}
		if (view.isDestroyed) return;
		// The block may have moved while the file was saved; it is found by identity.
		let at = view.state.doc.nodeAt(pos) === node ? pos : -1;
		if (at < 0) {
			view.state.doc.descendants((candidate, candidatePos) => {
				if (candidate === node) at = candidatePos;
				return at < 0;
			});
		}
		if (at < 0) {
			host.report(t('已存为 {path}；代码块已改动，没有替换', { path }));
			return;
		}
		const replaced = node.type.create(node.attrs, view.state.schema.text(`@file ./${path}`));
		view.dispatch(view.state.tr.replaceWith(at, at + node.nodeSize, replaced));
		host.report(t('已存为 {path}', { path }));
	};
}
