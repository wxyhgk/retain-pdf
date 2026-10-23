/**
 * The part of fast-mol's read-only build (fast-mol-viewer.js) the blog uses; its full types are in
 * fast-mol's own `dist/src/*.d.ts` (src/viewer/api.ts there).
 */

export type FastMolView = unknown;

export type FastMolMode = { frequency: number; intensity: number | null; raman: number | null; displacements: Float32Array };

export type FastMolViewer = {
	readonly canvas: HTMLCanvasElement;
	readonly atomCount: number;
	/** XYZ (several frames: a trajectory), a Gaussian log or fchk, an ORCA output, MOL/SDF, a cube. */
	loadText(text: string, format?: string): void;
	/** Atoms and their positions (one frame per geometry); the modes, those of the last frame. */
	load(input: { symbols: string[]; frames: Float32Array[]; modes?: FastMolMode[] }): void;
	/** `background`: any CSS colour. */
	set(options: { theme?: string; representation?: 'ball-stick' | 'stick' | 'spacefill'; labels?: string; background?: string; autoRotate?: boolean }): void;
	render(): void;
	resize(): void;
	dispose(): void;
	/** How it is turned, how near and where: saved, set later. */
	view: FastMolView;
	resetView(): void;
	readonly modes: {
		readonly list: ReadonlyArray<{ frequency: number; intensity: number | null }>;
		readonly current: number;
		/** Mode `index` vibrating (the atom moving most swings `amplitude` Å), or null: the structure as loaded. */
		show(index: number | null, options?: { amplitude?: number; arrows?: boolean }): void;
	};
};

export function createViewer(target: HTMLElement | HTMLCanvasElement | string, options?: { theme?: string }): FastMolViewer;
