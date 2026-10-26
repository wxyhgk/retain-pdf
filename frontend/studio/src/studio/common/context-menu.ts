export type MenuItem =
	| { label: string; action: () => void; danger?: boolean; hint?: string }
	| 'separator';

let open: { root: HTMLElement; close: () => void } | null = null;

/**
 * A menu at the pointer (or under an element, from the keyboard). It takes
 * focus, moves with the arrow keys, and closes on Escape, a click elsewhere,
 * a scroll or a blur, giving focus back to where it came from.
 */
export function showContextMenu(items: readonly MenuItem[], at: { x: number; y: number } | HTMLElement): void {
	open?.close();
	const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const root = document.createElement('div');
	root.className = 'block-menu context-menu';
	root.setAttribute('role', 'menu');
	for (const item of items) {
		if (item === 'separator') {
			const line = document.createElement('div');
			line.className = 'context-menu-separator';
			line.setAttribute('role', 'separator');
			root.append(line);
			continue;
		}
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `block-menu-item${item.danger ? ' is-danger' : ''}`;
		button.setAttribute('role', 'menuitem');
		button.tabIndex = -1;
		button.textContent = item.label;
		if (item.hint) {
			const hint = document.createElement('kbd');
			hint.textContent = item.hint;
			button.append(hint);
		}
		button.addEventListener('click', () => {
			close(false);
			item.action();
		});
		root.append(button);
	}
	document.body.append(root);

	const point = at instanceof HTMLElement ? (() => {
		const rect = at.getBoundingClientRect();
		return { x: rect.left + 24, y: rect.bottom };
	})() : at;
	const left = Math.min(point.x, window.innerWidth - root.offsetWidth - 8);
	const top = point.y + root.offsetHeight > window.innerHeight - 8 ? Math.max(8, point.y - root.offsetHeight) : point.y;
	root.style.left = `${Math.max(8, left)}px`;
	root.style.top = `${top}px`;

	const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
	buttons[0]?.focus();

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.isComposing) return;
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (event.key === 'Escape' || event.key === 'Tab') {
			event.preventDefault();
			close(true);
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const step = event.key === 'ArrowDown' ? 1 : -1;
			buttons[(index + step + buttons.length) % buttons.length]?.focus();
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus();
		}
	};
	const onPointerDown = (event: PointerEvent) => {
		if (!root.contains(event.target as Node)) close(false);
	};
	const onScroll = (event: Event) => {
		if (!root.contains(event.target as Node)) close(false);
	};
	const onBlur = () => close(false);

	function close(restoreFocus: boolean): void {
		if (open?.root !== root) return;
		open = null;
		root.remove();
		document.removeEventListener('keydown', onKeyDown, true);
		document.removeEventListener('pointerdown', onPointerDown, true);
		document.removeEventListener('scroll', onScroll, true);
		window.removeEventListener('blur', onBlur);
		if (restoreFocus) returnFocus?.focus();
	}

	document.addEventListener('keydown', onKeyDown, true);
	document.addEventListener('pointerdown', onPointerDown, true);
	document.addEventListener('scroll', onScroll, true);
	window.addEventListener('blur', onBlur);
	open = { root, close: () => close(false) };
}
