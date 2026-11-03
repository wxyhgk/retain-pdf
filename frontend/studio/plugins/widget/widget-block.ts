import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import type { EditorView } from '@milkdown/prose/view';

import { t } from '@blog/i18n/index.mjs';
import { loadWhenNear } from '@blog/editor-kit/near-screen.ts';
import { createWidget, startWidget } from './widget-host.ts';
import { WIDGET_LANGUAGE, publicArticlePath, widgetFile, widgetOptions } from './widgets.mjs';

/**
 * ```widget blocks in the editor (widgets.mjs): their HTML is edited as
 * HTML, and their preview is the frame the blog shows, redrawn as they change.
 */

const html = languages.find((language) => language.name === 'HTML');

/** The widget fence's language for the code editor: HTML's. */
export const widgetLanguageDescription = LanguageDescription.of({
	name: WIDGET_LANGUAGE,
	load: () => (html ? html.load() : Promise.reject(new Error('no HTML language'))),
});

/**
 * Widgets waiting to be drawn, by their key. Crepe passes a preview through
 * DOMPurify, which keeps no frame, so the preview is a placeholder naming
 * its widget, and observeWidgets draws the frame in its place. The latest
 * few are kept: the same preview is put in again when the block is redrawn.
 */
const waiting = new Map<string, { widget: { source: string } | { file: string }; meta: string }>();
const KEPT = 64;

/** A short name for a widget's source and options (FNV-1a). */
function keyOf(text: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
	return (hash >>> 0).toString(36);
}

/** The preview of a ```widget block (a placeholder observeWidgets draws); null for the other languages. */
export function widgetPreview(language: string, content: string, meta: string): HTMLElement | null {
	if (language.toLowerCase() !== WIDGET_LANGUAGE) return null;
	const key = keyOf(`${meta}\n${content}`);
	const named = widgetFile(content);
	const file = named ? publicArticlePath(named) : null;
	const widget = file
		? { file }
		: named
			? { source: `<p style="color: var(--muted)">${t('./{path} 不在页面的 img/ 或 assets/ 里，发布后读不到', { path: named.replace(/[<&]/gu, '') })}</p>` }
			: { source: content };
	waiting.delete(key);
	waiting.set(key, { widget, meta });
	if (waiting.size > KEPT) waiting.delete(waiting.keys().next().value as string);
	const placeholder = document.createElement('figure');
	placeholder.className = 'note-widget';
	placeholder.dataset.widget = key;
	placeholder.style.minHeight = `${widgetOptions(meta).height}px`;
	return placeholder;
}

/** Draws the widgets whose placeholders appear under `root`. */
export function observeWidgets(root: HTMLElement): () => void {
	const draw = () => {
		for (const placeholder of root.querySelectorAll<HTMLElement>('figure.note-widget[data-widget]')) {
			const widget = waiting.get(placeholder.dataset.widget ?? '');
			if (!widget) continue;
			// Started as it comes near the screen (its page, the files it reads, fetched then), in the article it is in.
			const figure = createWidget(widget.widget, widget.meta, { later: true });
			placeholder.replaceWith(figure);
			const article = figure.closest<HTMLElement>('.ProseMirror');
			if (article) loadWhenNear(article, figure, () => startWidget(figure));
			else startWidget(figure);
		}
	};
	const observer = new MutationObserver(draw);
	observer.observe(root, { childList: true, subtree: true });
	return () => observer.disconnect();
}

/** What a new widget starts as: a small one to change, in the notes' black and white. */
export const WIDGET_STARTER = {
	meta: 'title="Morse 势能" height=300', // i18n-ignore: written into the article
	source: /* i18n-ignore: written into the article */ `<label>阱深 Dₑ <input id="depth" type="range" min="1" max="10" value="5"></label>
<canvas id="plot" width="640" height="240"></canvas>
<script>
const depth = document.querySelector('#depth');
const canvas = document.querySelector('#plot');
function draw() {
  const g = canvas.getContext('2d');
  const { width, height } = canvas;
  g.clearRect(0, 0, width, height);
  g.strokeStyle = note.color('ink');
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= width; x += 1) {
    const r = 0.6 + (x / width) * 4;
    const v = depth.value * (1 - Math.exp(-1.2 * (r - 1.5))) ** 2;
    const y = height - 12 - (v / 12) * (height - 24);
    x ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}
depth.addEventListener('input', draw);
note.onTheme(draw);
draw();
</script>`,
};

/** Puts a new widget where the caret's (empty) block is. */
export function insertWidget(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes.code_block;
	if (!type) return;
	const { $from } = state.selection;
	const block = type.create({ language: WIDGET_LANGUAGE, meta: WIDGET_STARTER.meta }, state.schema.text(WIDGET_STARTER.source));
	view.dispatch(state.tr.replaceWith($from.before(), $from.after(), block).scrollIntoView());
	view.focus();
}
