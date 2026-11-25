export type CaretPoint = {
    top: number;
    left: number;
    height: number;
};
export declare function caretCoordinates(textarea: HTMLTextAreaElement, position: number): CaretPoint;
