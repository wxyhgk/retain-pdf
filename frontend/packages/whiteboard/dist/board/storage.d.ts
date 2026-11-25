import { type BoardDoc } from "./board-state.js";
export declare function loadBoard(key: string): BoardDoc;
export declare function saveBoard(key: string, doc: BoardDoc): void;
/** [doc, setDoc]：换 key 时读那一份；改了以后停一会儿再存。 */
export declare function useBoardStorage(key: string): [BoardDoc, (doc: BoardDoc) => void];
