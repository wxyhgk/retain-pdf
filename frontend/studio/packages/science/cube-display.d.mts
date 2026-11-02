export type CubeMoleculeStyle = 'stick' | 'sphere' | 'line';
export type CubeDisplaySettings = {
	isovalue: number;
	positive: boolean;
	negative: boolean;
	opacity: number;
	moleculeStyle: CubeMoleculeStyle;
};

export const CUBE_DISPLAY_DEFAULTS: Readonly<CubeDisplaySettings>;
export const CUBE_ISOVALUE_MIN: number;
export const CUBE_ISOVALUE_MAX: number;
export const CUBE_ISOVALUE_STEP: number;
export const CUBE_OPACITY_MIN: number;
export const CUBE_OPACITY_MAX: number;
export const CUBE_OPACITY_STEP: number;
export function isCubeDisplaySettings(value: unknown): value is CubeDisplaySettings;
export function normalizeCubeDisplaySettings(value: unknown): CubeDisplaySettings;
