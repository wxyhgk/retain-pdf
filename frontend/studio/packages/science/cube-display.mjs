export const CUBE_DISPLAY_DEFAULTS = Object.freeze({
	isovalue: 0.02,
	positive: true,
	negative: true,
	opacity: 0.72,
	moleculeStyle: 'stick',
});

export const CUBE_ISOVALUE_MIN = 0.005;
export const CUBE_ISOVALUE_MAX = 0.1;
export const CUBE_ISOVALUE_STEP = 0.005;
export const CUBE_OPACITY_MIN = 0.1;
export const CUBE_OPACITY_MAX = 1;
export const CUBE_OPACITY_STEP = 0.01;

const MOLECULE_STYLES = new Set(['stick', 'sphere', 'line']);

export function isCubeDisplaySettings(value) {
	return Boolean(
		value
		&& typeof value === 'object'
		&& !Array.isArray(value)
		&& Number.isFinite(value.isovalue)
		&& value.isovalue >= CUBE_ISOVALUE_MIN
		&& value.isovalue <= CUBE_ISOVALUE_MAX
		&& typeof value.positive === 'boolean'
		&& typeof value.negative === 'boolean'
		&& Number.isFinite(value.opacity)
		&& value.opacity >= CUBE_OPACITY_MIN
		&& value.opacity <= CUBE_OPACITY_MAX
		&& MOLECULE_STYLES.has(value.moleculeStyle)
	);
}

export function normalizeCubeDisplaySettings(value) {
	const settings = isCubeDisplaySettings(value) ? value : CUBE_DISPLAY_DEFAULTS;
	return {
		isovalue: settings.isovalue,
		positive: settings.positive,
		negative: settings.negative,
		opacity: settings.opacity,
		moleculeStyle: settings.moleculeStyle,
	};
}
