export type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';
export declare const CALLOUT_KINDS: Readonly<Record<CalloutKind, { icon: string; label: string }>>;
export declare const CALLOUT_ORDER: readonly CalloutKind[];
export declare function calloutMarker(text: string): { kind: CalloutKind; rest: string } | null;
export declare function takeCalloutMarker(blockquote: { children: Array<{ type: string; children?: Array<{ type: string; value?: string }> }> }): CalloutKind | null;
