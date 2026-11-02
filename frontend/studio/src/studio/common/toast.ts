import { createStore } from '../shell/store.ts';

export type ToastOptions = {
	error?: boolean;
	/** A button in the message (撤销), which closes it. */
	action?: { label: string; run: () => void };
};

/** The message shown (shell/Toast.tsx draws it): one at a time, the latest. */
export type ToastShown = { round: number; message: string; error: boolean; action?: ToastOptions['action'] };

export const toasts = createStore<{ shown: ToastShown | null }>({ shown: null });
let round = 0;

/** A short message at the bottom of the window, for what happens away from where the author is looking. */
export function showToast(message: string, options: boolean | ToastOptions = false): void {
	const { error = false, action } = typeof options === 'boolean' ? { error: options } : options;
	toasts.set({ shown: { round: ++round, message, error, action } });
}
