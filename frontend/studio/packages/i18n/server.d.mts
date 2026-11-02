import type { IncomingMessage } from 'node:http';
export declare function inRequestLocale<T>(request: IncomingMessage, answer: () => T): T;
export declare function askedLocales(header: string | null | undefined): string[];
export declare const LOCALE_COOKIE: 'studio-locale';
