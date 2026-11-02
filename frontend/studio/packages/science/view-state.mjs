/**
 * The views of molecules an article saves (article.views.json): how each is
 * turned, as the viewer that drew it keeps it.
 *
 * - fast-mol's (the molecules now): `{ rotation: [9 numbers, a row-major 3×3], zoom, pan: { x, y } }`.
 * - 3Dmol's (what was saved before, and the cubes until they move): 8 to 16 numbers.
 *   A molecule fast-mol draws does not read one; it is kept until the view is saved again.
 */

/** @typedef {{ rotation: number[], zoom: number, pan: { x: number, y: number } }} FastMolView */

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

/** @returns {view is FastMolView} */
export function isFastMolView(view) {
	return Boolean(
		view &&
			typeof view === 'object' &&
			!Array.isArray(view) &&
			Array.isArray(view.rotation) &&
			view.rotation.length === 9 &&
			view.rotation.every(finite) &&
			finite(view.zoom) &&
			view.zoom > 0 &&
			view.pan &&
			finite(view.pan.x) &&
			finite(view.pan.y),
	);
}

/** @returns {view is number[]} */
export function is3DmolView(view) {
	return Array.isArray(view) && view.length >= 8 && view.length <= 16 && view.every(finite);
}

/** A copy of a view of either kind, nothing else in it; null when it is neither. */
export function copyView(view) {
	if (isFastMolView(view)) return { rotation: [...view.rotation], zoom: view.zoom, pan: { x: view.pan.x, y: view.pan.y } };
	if (is3DmolView(view)) return [...view];
	return null;
}
