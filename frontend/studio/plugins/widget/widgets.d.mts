export declare const WIDGET_LANGUAGE: 'widget';
export declare const WIDGET_MESSAGE: 'note-widget';
export declare const DEFAULT_WIDGET_HEIGHT: number;
export declare function widgetOptions(meta: string | null | undefined): { title: string; height: number };
/** `colors`: the page's, by name without the dashes (`ink`, `muted`…), put in the frame as CSS variables. */
/** `given`: whether there is an AI to ask (`note.canAsk`), and what the widget told of itself before (`note.state`). */
export declare function widgetDocument(source: string, colors?: Record<string, string>, given?: { canAsk?: boolean; state?: unknown }): string;
export declare function unpinnedScripts(source: string): string[];
export declare function publicArticlePath(written: string): string | null;
export declare function widgetFile(source: string): string | null;
export declare function widgetReads(source: string): string[];
