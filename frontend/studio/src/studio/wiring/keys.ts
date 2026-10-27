// What the whole page does on its keys (⌘K, ⌘S, ⌫ where nothing takes it) and on leaving; Vite's reloads kept off it.
import type { ArticleSession } from '../state/article-session';

export function bindPageKeys(session: ArticleSession, { find }: { find(): void }): void {
	// ⌘K or ⌘P (Ctrl elsewhere) finds an article, from anywhere; ⌘K on text selected in the editor links it instead.
	document.addEventListener('keydown', (event) => {
		if (event.defaultPrevented || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || !['k', 'p'].includes(event.key.toLowerCase())) return;
		event.preventDefault();
		find();
	});

	// Saving is automatic; ⌘S (or ⌘↩) saves at once (in a plugin's frame too, through its `ctx.studio.save`).
	document.addEventListener('keydown', (event) => {
		if (!(event.metaKey || event.ctrlKey) || event.altKey || (event.key !== 'Enter' && event.key.toLowerCase() !== 's')) return;
		event.preventDefault();
		void session.flush();
	});
	// ⌫ that nothing took (a structure editor with nothing left to delete) is "back" to WebKit, the Mac
	// app's browser: the Studio would leave for the app's start page. Where it isn't typed into, it does nothing.
	window.addEventListener('keydown', (event) => {
		if (event.key !== 'Backspace' || event.defaultPrevented) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
		event.preventDefault();
	});
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden' && session.hasUnsavedEdits()) void session.flush();
	});
	window.addEventListener('beforeunload', (event) => {
		if (!session.hasUnsavedEdits()) return;
		void session.flush();
		event.preventDefault();
	});

	// Astro reloads every open page when an article's Markdown changes, which
	// with autosave is every few seconds. The Studio follows those changes
	// itself, so a reload marked as theirs (content-reloads.mjs) is pointed at
	// another page, which Vite then leaves alone.
	import.meta.hot?.on('vite:beforeFullReload', (payload: { path?: string; studioContentChange?: boolean }) => {
		if (payload.studioContentChange) payload.path = '/studio-keeps-open.html';
	});
}
