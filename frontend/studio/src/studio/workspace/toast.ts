let current: { element: HTMLElement; timer: number } | null = null;

/** A short message at the bottom of the window, for what happens away from where the author is looking. */
export function showToast(message: string, error = false): void {
	if (current) {
		window.clearTimeout(current.timer);
		current.element.remove();
	}
	const element = document.createElement('div');
	element.className = `studio-toast${error ? ' is-error' : ''}`;
	element.setAttribute('role', error ? 'alert' : 'status');
	element.textContent = message;
	document.body.append(element);
	const timer = window.setTimeout(() => {
		element.remove();
		if (current?.element === element) current = null;
	}, error ? 8000 : 3500);
	current = { element, timer };
}
