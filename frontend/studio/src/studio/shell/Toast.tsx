import { useEffect } from 'react';

import { cn } from '@studio/lib/utils';
import { toasts, type ToastShown } from '../common/toast';
import { useStore } from './store';

const gone = (round: number) => () => {
	if (toasts.get().shown?.round === round) toasts.set({ shown: null });
};

function Message({ shown }: { shown: ToastShown }) {
	// Long enough to change one's mind when there is something to undo.
	useEffect(() => {
		const timer = window.setTimeout(gone(shown.round), shown.error || shown.action ? 8000 : 3500);
		return () => window.clearTimeout(timer);
	}, []);
	return (
		<div
			role={shown.error ? 'alert' : 'status'}
			className={cn(
				'studio-toast fixed bottom-6 left-1/2 z-[60] flex max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3.5 rounded-lg px-3.5 py-2 text-xs leading-normal shadow-lg animate-in fade-in-0 slide-in-from-bottom-2',
				shown.error ? 'is-error bg-destructive text-white' : 'bg-foreground text-background',
			)}
		>
			<span>{shown.message}</span>
			{shown.action && (
				<button
					type="button"
					className="studio-toast-action flex-none rounded-[5px] border border-current/35 px-2 py-0.5 font-semibold hover:bg-white/10"
					onClick={() => {
						gone(shown.round)();
						shown.action!.run();
					}}
				>
					{shown.action.label}
				</button>
			)}
		</div>
	);
}

/** The message at the bottom of the window (common/toast.ts shows it): the latest only. */
export function Toast() {
	const { shown } = useStore(toasts);
	return shown ? <Message key={shown.round} shown={shown} /> : null;
}
