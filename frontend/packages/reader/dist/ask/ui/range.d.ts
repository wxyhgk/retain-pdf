/**
 * Range normalization for the numeric props the elements take.
 *
 * Elements are driven by a caller's state, so a prop can arrive negative, past
 * the end of its collection, or NaN. Left raw, those reach the DOM: a negative
 * percentage is an invalid CSS width that the browser drops, leaving a bar at
 * its natural full width, and a negative slice length counts from the end of
 * the array instead of returning nothing.
 */
/**
 * Constrains a value to `min…max`. NaN is decided first and maps to `min`.
 * For any other value, an empty collection can invert the bounds and `max`
 * wins there: `clamp(3, 1, 0)` is `0`, which is what lets a floor of one item
 * still yield none.
 */
export declare function clamp(value: number, min: number, max: number): number;
/** The first `count` items, for a `count` that may be out of range. */
export declare function take<T>(items: readonly T[], count: number): T[];
/** The position `index` names in `items`, for an `index` out of range. */
export declare function indexIn<T>(items: readonly T[], index: number): number;
/** The item at `index`, for an `index` that may be out of range. */
export declare function at<T>(items: readonly T[], index: number): T;
/** `value` as a share of `total`, as a percentage in `0…100`. */
export declare function pct(value: number, total: number): number;
/**
 * A `0…100` share as it should be announced. `pct` divides, so a share that
 * reads as a whole number on screen can still reach `aria-valuenow` carrying
 * float error, which a screen reader reads out in full.
 */
export declare function announced(share: number): number;
/** A count of completed items out of `total`, in `0…total`. */
export declare function progressOf(index: number, total: number): number;
//# sourceMappingURL=range.d.ts.map