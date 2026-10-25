import type { Ctx } from '@milkdown/ctx';
import { commandsCtx, editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { Fragment } from '@milkdown/prose/model';
import { Plugin, PluginKey, type EditorState } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { DRIVE_DRAG_TYPE, fileName, readMarkdownReference, STUDIO_FILE_DRAG_TYPE, STUDIO_MARKDOWN_DRAG_TYPE } from '../article-files.ts';
import { dropHasFolder } from '../dropped-files.ts';

/** What dropping files into the editor needs from the Studio around it. */
export type ArticleFileDropHost = {
	/** Uploads into the open article (pictures to `img/`, the rest to `assets/`); the paths they got. */
	upload(files: readonly File[]): Promise<string[]>;
	/** Copies a file of the drive (资料库) into the open article; the path it got there. */
	fromDrive(path: string): Promise<string>;
	/** The start of a file of the open article, to tell what wrote it (a Gaussian output among other logs). */
	head(path: string): Promise<string | null>;
	/** Something went wrong, or something the author should know happened. */
	report(message: string, error?: boolean): void;
};

type PlaceholderAction = { add: { id: symbol; pos: number; label: string } } | { remove: symbol };

const placeholderKey = new PluginKey<DecorationSet>('article-file-placeholders');

function findPlaceholder(state: EditorState, id: symbol): number {
	const found = placeholderKey.getState(state)?.find(undefined, undefined, (spec) => spec.id === id);
	return found?.[0]?.from ?? -1;
}

/**
 * Where blocks go for a drop or paste at `pos`: in place of an empty
 * paragraph, before a paragraph when at its start, otherwise after it, so a
 * picture never splits a sentence.
 */
function blockRange(state: EditorState, pos: number): { from: number; to: number } {
	const $pos = state.doc.resolve(Math.max(0, Math.min(pos, state.doc.content.size)));
	if (!$pos.parent.isTextblock || $pos.depth === 0) return { from: $pos.pos, to: $pos.pos };
	const depth = $pos.depth;
	if ($pos.parent.content.size === 0) return { from: $pos.before(depth), to: $pos.after(depth) };
	const at = $pos.parentOffset === 0 ? $pos.before(depth) : $pos.after(depth);
	return { from: at, to: at };
}

/**
 * Files go into the article the way a writer means them: dropped or pasted
 * into the editor, they are uploaded to the article folder and the editor
 * gets the Markdown that uses them (a picture, an `@file` chemistry block, a
 * link). A file dragged from the file panel is inserted the same way without
 * uploading. The editor's own Markdown parser builds the blocks, so they are
 * exactly what opening that Markdown would give.
 *
 * These run as DOM handlers, ahead of Crepe's own uploader, which only knows
 * pictures and keeps them as `blob:` URLs.
 */
export function articleFileDrop(host: ArticleFileDropHost) {
	let editorCtx: Ctx | null = null;

	function blocks(markdown: readonly string[]): Fragment {
		return editorCtx!.get(parserCtx)(markdown.join('\n\n')).content;
	}

	function insertAt(view: EditorView, pos: number, markdown: readonly string[], placeholder?: symbol): void {
		const tr = view.state.tr;
		if (placeholder) tr.setMeta(placeholderKey, { remove: placeholder } satisfies PlaceholderAction);
		if (markdown.length) {
			const { from, to } = blockRange(view.state, pos);
			tr.replaceWith(from, to, blocks(markdown));
		}
		view.dispatch(tr.scrollIntoView());
	}

	function upload(view: EditorView, pos: number, files: readonly File[]): void {
		const label = files.length === 1 ? `正在上传 ${files[0].name}…` : `正在上传 ${files.length} 个文件…`;
		bring(view, pos, label, () => host.upload(files), '上传');
	}

	/** Files coming into the article (`task`), a placeholder at `pos` until they are there and put in its place. */
	function bring(view: EditorView, pos: number, label: string, task: () => Promise<string[]>, verb: string): void {
		const id = Symbol('upload');
		view.dispatch(view.state.tr.setMeta(placeholderKey, { add: { id, pos, label } } satisfies PlaceholderAction));
		task().then(
			async (paths) => {
				const references = await Promise.all(paths.map((path) => readMarkdownReference(path, host.head)));
				if (view.isDestroyed) return;
				const at = findPlaceholder(view.state, id);
				const markdown = references.filter((reference): reference is string => reference !== null);
				if (at < 0) {
					host.report(`已${verb} ${paths.join('、')}，但插入的位置已被删除`);
					return;
				}
				insertAt(view, at, markdown, id);
				host.report(paths.length === 1 ? `已${verb} ${paths[0]}` : `已${verb} ${paths.length} 个文件`);
			},
			(error: unknown) => {
				if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(placeholderKey, { remove: id } satisfies PlaceholderAction));
				host.report(error instanceof Error ? error.message : `${verb}失败`, true);
			},
		);
	}

	const plugin = $prose((ctx) => {
		editorCtx = ctx;
		return new Plugin<DecorationSet>({
			key: placeholderKey,
			state: {
				init: () => DecorationSet.empty,
				apply(tr, set) {
					const mapped = set.map(tr.mapping, tr.doc);
					const action = tr.getMeta(placeholderKey) as PlaceholderAction | undefined;
					if (!action) return mapped;
					if ('remove' in action) return mapped.remove(mapped.find(undefined, undefined, (spec) => spec.id === action.remove));
					const widget = document.createElement('span');
					widget.className = 'upload-placeholder';
					widget.textContent = action.add.label;
					return mapped.add(tr.doc, [Decoration.widget(action.add.pos, widget, { id: action.add.id, side: -1 })]);
				},
			},
			props: {
				decorations: (state) => placeholderKey.getState(state),
				handleDOMEvents: {
					paste(view, event) {
						const data = event.clipboardData;
						const files = [...(data?.files ?? [])];
						// Word and Excel put a picture of the copied text next to the text; that is a text paste.
						if (!data || !files.length || data.getData('text/plain').trim()) return false;
						event.preventDefault();
						upload(view, view.state.selection.from, files);
						return true;
					},
					drop(view, event) {
						const transfer = event.dataTransfer;
						if (!transfer) return false;
						// Blocks of what an AI said (the AI panel): their Markdown made blocks here, as pasted Markdown is.
						const said = transfer.getData(STUDIO_MARKDOWN_DRAG_TYPE);
						if (said) {
							event.preventDefault();
							const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
							insertAt(view, at, [said]);
							view.focus();
							return true;
						}
						// From the drive: copied into the article first.
						const fromDrive = transfer.getData(DRIVE_DRAG_TYPE);
						if (fromDrive) {
							event.preventDefault();
							const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
							bring(view, at, `正在从资料库复制 ${fileName(fromDrive)}…`, async () => [await host.fromDrive(fromDrive)], '复制到文章');
							return true;
						}
						const path = transfer.getData(STUDIO_FILE_DRAG_TYPE);
						const files = [...transfer.files];
						if (!path && !files.length) return false;
						event.preventDefault();
						if (dropHasFolder(transfer)) {
							host.report('文件夹请拖到右侧的文件面板，那里会保留它的子文件夹', true);
							return true;
						}
						const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
						if (files.length) {
							upload(view, pos, files);
							return true;
						}
						void readMarkdownReference(path, host.head).then((reference) => {
							if (view.isDestroyed) return;
							if (reference) insertAt(view, Math.min(pos, view.state.doc.content.size), [reference]);
							else host.report('ai/ 里的文件不随文章发布，不能插入正文', true);
						});
						return true;
					},
				},
			},
		});
	});

	/** The slash menu's 图片: choose pictures, upload them, and put them where the menu was opened. */
	function chooseImages(ctx: Ctx): void {
		ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
		const view = ctx.get(editorViewCtx);
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.multiple = true;
		input.addEventListener('change', () => {
			const files = [...(input.files ?? [])];
			if (files.length && !view.isDestroyed) upload(view, view.state.selection.from, files);
		});
		input.click();
	}

	return { plugin, chooseImages };
}

type SlashMenuItems = { getGroup(key: string): { group: { items: Array<{ key: string; onRun?: (ctx: Ctx) => void }> } } };

/** Points the slash menu's 图片 at `run` instead of Crepe's image block. */
export function replaceSlashImageItem(builder: SlashMenuItems, run: (ctx: Ctx) => void): void {
	const item = builder.getGroup('advanced').group.items.find((entry) => entry.key === 'image');
	if (item) item.onRun = run;
}
