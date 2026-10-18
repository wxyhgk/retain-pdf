export declare function leadingAttributes(text: string): { attributes: string; length: number } | null;
export declare function onlyAttributes(text: string): string | null;
export declare function figureWidth(attributes: string | null | undefined): string | null;
export declare function withWidth(attributes: string | null | undefined, width: string | null): string;
export declare function figureCaption(alt: string | null | undefined, src: string | null | undefined): string;
export declare function figureLabel(number: number): string;

type MdastImage = { type: 'image'; url: string; alt?: string | null; title?: string | null };
export declare function standaloneImage<Image extends MdastImage = MdastImage>(paragraph: {
	children?: readonly { type: string; value?: string }[];
}): { image: Image; attributes: string } | null;
