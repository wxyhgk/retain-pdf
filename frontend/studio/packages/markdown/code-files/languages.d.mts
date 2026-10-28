import type { StreamParser } from '@codemirror/language';

export type CodeFileLanguage = {
	name: string;
	label: string;
	aliases: readonly string[];
	file: string;
	extensions: readonly string[];
	names: readonly string[];
	parser: StreamParser<unknown>;
};

export declare const codeFileLanguages: readonly CodeFileLanguage[];
export declare function codeFileLanguage(language: unknown): CodeFileLanguage | undefined;
export declare function codeFileLanguageForPath(path: string): string | undefined;
/** The fence language a text file is shown in (an input or output, code, data); undefined for one that is not text. */
export declare function textFileLanguage(path: string): string | undefined;
export declare const codeFileFenceNames: readonly string[];
