import { useSyncExternalStore } from 'react';

/** A value the Studio's parts change and React draws: `set` merges what is given (unchanged, nothing is told). */
export type Store<T extends object> = {
	get(): T;
	set(change: Partial<T>): void;
	subscribe(listener: () => void): () => void;
};

export function createStore<T extends object>(initial: T): Store<T> {
	let state = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set(change) {
			if (Object.entries(change).every(([key, value]) => Object.is(state[key as keyof T], value))) return;
			state = { ...state, ...change };
			for (const listener of listeners) listener();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

/** The store's value, drawn again when it changes; `initial` as the server draws it. */
export function useStore<T extends object>(store: Store<T>, initial: T = store.get()): T {
	return useSyncExternalStore(store.subscribe, store.get, () => initial);
}
