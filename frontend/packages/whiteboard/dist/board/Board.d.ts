import { type BoardDoc } from "./board-state.js";
export type BoardProps = {
    doc: BoardDoc;
    onChange: (doc: BoardDoc) => void;
    className?: string;
    /** 白板的名字（读屏用）。 */
    label?: string;
};
export declare function Board({ doc, onChange, className, label }: BoardProps): import("react").JSX.Element;
