import { useEffect, useRef } from 'react';

/**
 * A name typed in place (a file renamed, a folder made): Enter or leaving it keeps it, Escape gives it up. Given back
 * once, trimmed; null when given up, empty or unchanged. Selected to the extension, so typing replaces the name only.
 */
export function NameInput({ className, value, label, keepExtension, onDone }: { className: string; value: string; label: string; keepExtension: boolean; onDone(name: string | null, how: 'enter' | 'escape' | 'blur'): void }) {
	const input = useRef<HTMLInputElement>(null);
	const done = useRef(false);
	useEffect(() => {
		const field = input.current;
		if (!field) return;
		field.focus();
		const dot = keepExtension ? value.lastIndexOf('.') : -1;
		field.setSelectionRange(0, dot > 0 ? dot : value.length);
	}, []);
	const finish = (keep: boolean, how: 'enter' | 'escape' | 'blur') => {
		if (done.current) return;
		done.current = true;
		const name = input.current?.value.trim() ?? '';
		onDone(keep && name && name !== value ? name : null, how);
	};
	return (
		<input
			ref={input}
			className={className}
			defaultValue={value}
			spellCheck={false}
			aria-label={label}
			onKeyDown={(event) => {
				event.stopPropagation();
				if (event.nativeEvent.isComposing) return;
				if (event.key === 'Enter') {
					event.preventDefault();
					finish(true, 'enter');
				} else if (event.key === 'Escape') {
					event.preventDefault();
					finish(false, 'escape');
				}
			}}
			onBlur={() => finish(true, 'blur')}
			onClick={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
			onContextMenu={(event) => event.stopPropagation()}
		/>
	);
}
