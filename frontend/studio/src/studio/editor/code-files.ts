import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';

import { enhanceCodeFiles } from '../../code-files/browser.ts';
import { downloadName, parseFenceMeta } from '../../code-files/highlight.mjs';
import { codeFileLanguages } from '../../code-files/languages.mjs';
import { codeFileProblem, type HastChild, type HastElement } from '../../code-files/render.mjs';
import '../../code-files/code-files.css';
import { parseScienceResourceRef } from '../../science/parsers/resource-reference.ts';
import type { ArticleFileDropHost } from './file-drop.ts';
import { isFormulaBlock } from './formula-block.ts';

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
			(drawn) => apply(draw(drawn)),
			(error: unknown) => apply(draw(codeFileProblem(language, error instanceof Error ? error.message : `找不到文件 ${path}`))),
		);
		return undefined;
	};
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
			host.report(error instanceof Error ? error.message : '保存文件失败', true);
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
			host.report(`已存为 ${path}；代码块已改动，没有替换`);
			return;
		}
		const replaced = node.type.create(node.attrs, view.state.schema.text(`@file ./${path}`));
		view.dispatch(view.state.tr.replaceWith(at, at + node.nodeSize, replaced));
		host.report(`已存为 ${path}`);
	};
}
