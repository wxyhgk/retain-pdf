let current: { element: HTMLElement; timer: number } | null = null;

export type ToastOptions = {
	error?: boolean;
	/** A button in the message (撤销), which closes it. */
	action?: { label: string; run: () => void };
};

/** A short message at the bottom of the window, for what happens away from where the author is looking. */
export function showToast(message: string, options: boolean | ToastOptions = false): void {
	const { error = false, action } = typeof options === 'boolean' ? { error: options } : options;
	if (current) {
		window.clearTimeout(current.timer);
		current.element.remove();
	}
	const element = document.createElement('div');
	element.className = `studio-toast${error ? ' is-error' : ''}`;
	element.setAttribute('role', error ? 'alert' : 'status');
	element.textContent = message;
	const close = () => {
		element.remove();
		if (current?.element === element) current = null;
	};
	if (action) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'studio-toast-action';
		button.textContent = action.label;
		button.addEventListener('click', () => {
			close();
			action.run();
		});
		element.append(button);
	}
	document.body.append(element);
	// Long enough to change one's mind when there is something to undo.
	const timer = window.setTimeout(close, error ? 8000 : action ? 8000 : 3500);
	current = { element, timer };
}
