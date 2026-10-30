/**
 * What a ```widget says to what it is in, as events on its figure (plugins/widget/widget-host.ts sends them): what it
 * asks the AI (`note.ask`), what it is at now (`note.tell`), and, as it starts, what it is given. The AI panel takes
 * them for its conversation, the Studio for the article's; on the blog no one does.
 */

/** `WidgetAsk`: what a widget asks the AI, for the reader; cancelled when it is taken (said, or put in the AI's input). */
export const WIDGET_ASK = 'note-widget-ask';
/** `WidgetTold`: what a widget is at now, for the AI to be told with what is said next. */
export const WIDGET_STATE = 'note-widget-state';
/** `WidgetStart`: a widget starting; what it is in sets whether it may ask, what it told before, whether it may be shown large. */
export const WIDGET_START = 'note-widget-start';

export type WidgetAsk = { text: string; title: string };
export type WidgetTold = { state: unknown; title: string };
export type WidgetStart = { title: string; canAsk: boolean; state?: unknown; expand?: boolean };
