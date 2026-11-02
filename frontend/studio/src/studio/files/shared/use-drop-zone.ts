import { useRef, useState, type DragEvent } from 'react';

/**
 * Where a drag over a list means to land, and what dropping there does. A row is lit by its key (a path); '' lights
 * the whole list; null, nothing.
 */
export type DropZone = {
	/** Whether this drag is the list's to take (files from the desktop, a row of its own). */
	accepts(types: readonly string[]): boolean;
	/** Where a drop on `target` would land: a row's key, '' for the list, null for nowhere. */
	over(target: EventTarget | null, types: readonly string[]): string | null;
	effect(types: readonly string[], over: string | null): DataTransfer['dropEffect'];
	/** The drop: true when taken (the browser then does nothing of its own with it). */
	drop(transfer: DataTransfer, over: string | null, target: EventTarget | null): boolean;
};

/** A list taking drops: the handlers to put on it, and what is lit. */
export function useDropZone(zone: DropZone) {
	const [lit, setLit] = useState<string | null>(null);
	const latest = useRef(zone);
	latest.current = zone;
	const types = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])];
	return {
		lit,
		handlers: {
			onDragOver(event: DragEvent) {
				const kinds = types(event);
				if (!latest.current.accepts(kinds)) return;
				event.preventDefault();
				const over = latest.current.over(event.target, kinds);
				setLit(over);
				event.dataTransfer.dropEffect = latest.current.effect(kinds, over);
			},
			onDragLeave(event: DragEvent) {
				if (!(event.currentTarget as Node).contains(event.relatedTarget as Node | null)) setLit(null);
			},
			onDragEnd() {
				setLit(null);
			},
			onDrop(event: DragEvent) {
				setLit(null);
				const transfer = event.dataTransfer;
				if (!transfer) return;
				const kinds = [...transfer.types];
				if (latest.current.drop(transfer, latest.current.over(event.target, kinds), event.target)) event.preventDefault();
			},
		},
	};
}
