import type { Ctx } from '@milkdown/ctx';
import { commandsCtx, editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark';
import type { Fragment } from '@milkdown/prose/model';
import { Plugin, PluginKey, type EditorState } from '@milkdown/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

import { markdownReference, STUDIO_FILE_DRAG_TYPE } from '../workspace/file-tree.ts';

/** What dropping files into the editor needs from the Studio around it. */
export type ArticleFileDropHost = {
	/** Uploads into the open article (pictures to `img/`, the rest to `assets/`); the paths they got. */
	upload(files: readonly File[]): Promise<string[]>;
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
		const id = Symbol('upload');
		const label = files.length === 1 ? `正在上传 ${files[0].name}…` : `正在上传 ${files.length} 个文件…`;
		view.dispatch(view.state.tr.setMeta(placeholderKey, { add: { id, pos, label } } satisfies PlaceholderAction));
		host.upload(files).then(
			(paths) => {
				if (view.isDestroyed) return;
				const at = findPlaceholder(view.state, id);
				const markdown = paths.map(markdownReference).filter((reference): reference is string => reference !== null);
				if (at < 0) {
					host.report(`已上传 ${paths.join('、')}，但插入的位置已被删除`);
					return;
				}
				insertAt(view, at, markdown, id);
				host.report(paths.length === 1 ? `已上传 ${paths[0]}` : `已上传 ${paths.length} 个文件`);
			},
			(error: unknown) => {
				if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(placeholderKey, { remove: id } satisfies PlaceholderAction));
				host.report(error instanceof Error ? error.message : '上传失败', true);
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
						const path = transfer.getData(STUDIO_FILE_DRAG_TYPE);
						const files = [...transfer.files];
						if (!path && !files.length) return false;
						event.preventDefault();
						const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
						if (files.length) {
							upload(view, pos, files);
							return true;
						}
						const reference = markdownReference(path);
						if (reference) insertAt(view, pos, [reference]);
						else host.report('ai/ 里的文件不随文章发布，不能插入正文', true);
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
