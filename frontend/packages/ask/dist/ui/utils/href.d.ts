/**
 * Link targets the elements take from a model or a tool.
 *
 * React 19 refuses a `javascript:` href but React 18 only warns, and neither
 * blocks `data:` or `vbscript:`, so an element passes a caller's URL through
 * here before it becomes an `href` or a navigation target.
 */
/**
 * `url` when a browser following it runs no script: an `http:`, `https:`, or
 * `mailto:` URL, or one relative to the page. Anything else, including a
 * string that is not a URL at all, is `undefined`.
 */
export declare function safeHref(url: string | undefined): string | undefined;
/** The host `url` points at, without a leading `www.`, or `undefined`. */
export declare function hostOf(url: string | undefined): string | undefined;
/**
 * Whether `url` may be fetched without a user action: a URL relative to the
 * page, a `data:` image, audio or video, a `blob:` URL, or an `http:` or
 * `https:` URL whose origin is listed in `origins`.
 */
export declare function canPreload(url: string | undefined, origins: readonly string[] | undefined): boolean;
/**
 * `value` when every `url(...)` in this CSS `background-image` value passes
 * `canPreload`, otherwise `undefined`. Escapes, `image-set()`, `var()`,
 * `env()`, `attr()` and `src()` are refused, since they can name a URL
 * without a plain `url(...)`.
 */
export declare function safeBackgroundImage(value: string | undefined, origins: readonly string[] | undefined): string | undefined;
