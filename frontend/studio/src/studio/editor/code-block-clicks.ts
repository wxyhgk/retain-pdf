import { EditorView } from '@codemirror/view';

/**
 * A click anywhere in a code block (its top, where the language is; its line numbers; its sides) is in its code, as
 * Notion's: the caret at the nearest place. CodeMirror itself takes only those on the code, and below it. Not on a
 * block that shows only its preview (a widget's), nor on its buttons.
 */
export function clickIntoCodeBlocks(root: HTMLElement): void {
	root.addEventListener(
		'mousedown',
		(event) => {
			if (event.button !== 0 || event.detail > 1 || event.shiftKey) return;
			const target = event.target instanceof Element ? event.target : null;
			const block = target?.closest('.milkdown-code-block');
			if (!block || target!.closest('.cm-content, button, input, .language-picker, .codemirror-host.hidden')) return;
			if (block.querySelector('.codemirror-host.hidden')) return;
			const editor = block.querySelector('.cm-editor');
			const view = editor instanceof HTMLElement ? EditorView.findFromDOM(editor) : null;
			if (!view) return;
			event.preventDefault();
			view.dispatch({ selection: { anchor: view.posAtCoords({ x: event.clientX, y: event.clientY }, false) } });
			view.focus();
		},
		true,
	);
}
