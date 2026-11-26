import { type ReactElement, type ReactNode } from "react";
export type AskPageJump = {
    pageCount: number;
    jump: (page: number) => void;
};
export declare const AskPageContext: import("react").Context<AskPageJump>;
/** 一个页码标签。跳不了（没给跳转、页码超出这本书）就照原样显示字。 */
export declare function AskPageLink({ page, children }: {
    page: number;
    children: ReactNode;
}): ReactElement;
/** 一段纯文字里的页码换成页码标签。 */
export declare function AskPageText({ text }: {
    text: string;
}): ReactElement;
