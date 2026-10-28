import { basicSetup } from 'codemirror';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { studioFileUrl } from '@blog/markdown/articles/article-references.mjs';
import { textFileLanguage } from '@blog/markdown/code-files/languages.mjs';
import { t } from '@blog/i18n/index.mjs';
import { openBlockSheet } from '@blog/ui/block-sheet.ts';
import { uploadArticleFile } from '../api/client';
import { codeFileLanguageDescriptions } from '../editor/code-files';

/** A file larger is shown, not edited (an editor of tens of MB is no use). */
const LARGEST = 2 * 1024 * 1024;

/**
 * A text file of the article (a script, an input, data) opened to read and change: a code editor over the page, its
 * language coloured; ⌘S or 保存 writes it back, and so does closing it with changes not saved (nothing is lost). Opened
 * from a code-file block (编辑, a double-click) and from the 文件 tab. `saved` is told once the file is written.
 */
export function openFileEditor({ slug, path, saved, toast }: { slug: string; path: string; saved?(path: string): void; toast(message: string, error?: boolean): void }): void {
	const name = path.split('/').pop() ?? path;
	let view: EditorView | null = null;
	/** The text as the file has it now (saved). */
	let kept: string | null = null;
	const status = document.createElement('span');
	status.className = 'file-editor-status';
	const changed = () => view !== null && kept !== null && view.state.doc.toString() !== kept;
	const say = () => {
		status.textContent = kept === null ? '' : changed() ? t('有改动，⌘S 保存') : t('已保存');
	};

	async function save(): Promise<void> {
		if (!view || !changed()) return;
		const text = view.state.doc.toString();
		const folder = path.split('/').slice(0, -1).join('/');
		await uploadArticleFile(slug, folder, new File([text], name, { type: 'text/plain' }), { replace: true }).then(
			() => {
				kept = text;
				say();
				saved?.(path);
			},
			(error: unknown) => toast(error instanceof Error ? error.message : t('没能保存 {path}', { path }), true),
		);
	}

	const sheet = openBlockSheet({
		kind: textFileLanguage(path) ?? t('文件'),
		title: path,
		tabs: [
			{
				key: 'file',
				label: t('文件'),
				wide: true,
				draw(panel) {
					panel.classList.add('file-editor');
					const note = document.createElement('p');
					note.className = 'file-editor-note';
					note.textContent = t('正在读 {path}…', { path });
					panel.append(note);
					void read(panel, note);
					// Esc closes it, heard before anything else on the page (some of which take Esc for their own, and then the
					// dialog would not close); the editor's own first: a completion or the search open is closed by it.
					const escape = (event: KeyboardEvent) => {
						if (event.key !== 'Escape' || event.isComposing) return;
						if (view?.dom.querySelector('.cm-tooltip-autocomplete, .cm-search')) return;
						event.preventDefault();
						event.stopPropagation();
						sheet.close();
					};
					window.addEventListener('keydown', escape, true);
					return () => {
						window.removeEventListener('keydown', escape, true);
						// Closed with changes: written, not lost.
						if (changed()) void save();
						view?.destroy();
					};
				},
			},
		],
		actions: [{ label: t('保存'), title: '⌘S', primary: true, run: () => void save() }],
	});

	async function read(panel: HTMLElement, note: HTMLElement): Promise<void> {
		let text: string;
		try {
			const response = await fetch(studioFileUrl(slug, path), { cache: 'no-store' });
			if (!response.ok) throw new Error(t('读不到 {path}', { path }));
			const size = Number(response.headers.get('content-length') ?? 0);
			if (size > LARGEST) {
				note.textContent = t('{path} 太大（{size} MB），不在这里编辑', { path, size: (size / 1048576).toFixed(1) });
				return;
			}
			text = await response.text();
		} catch (error) {
			note.textContent = error instanceof Error ? error.message : String(error);
			return;
		}
		if (text.includes('\0')) {
			note.textContent = t('{path} 不是文本文件', { path });
			return;
		}
		if (!sheet.isOpen()) return;
		kept = text;
		note.remove();
		const language = new Compartment();
		view = new EditorView({
			parent: panel,
			state: EditorState.create({
				doc: text,
				extensions: [
					keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => (void save(), true) }]),
					basicSetup,
					language.of([]),
					EditorView.updateListener.of((update) => update.docChanged && say()),
				],
			}),
		});
		say();
		view.focus();
		// Its language's colours, once loaded (Python, Fortran, a Gaussian input…).
		const described = LanguageDescription.matchFilename([...codeFileLanguageDescriptions, ...languages], name) ?? LanguageDescription.matchLanguageName([...codeFileLanguageDescriptions, ...languages], textFileLanguage(path) ?? '', true);
		const support = await described?.load().catch(() => null);
		if (support && view) view.dispatch({ effects: language.reconfigure(support) });
	}

	// Whether it is saved, beside 保存.
	document.querySelector('.block-sheet-actions')?.prepend(status);
}
