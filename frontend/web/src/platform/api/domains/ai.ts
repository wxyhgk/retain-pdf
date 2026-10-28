import * as MockAi from "../mocks/ai.js";
import {
  askLibraryAi as _canonAskLibraryAi,
  readAiAskStream as _canonReadAiAskStream,
  AiAskError as _CanonAiAskError,
  jobBoardFileUrl as _canonJobBoardFileUrl,
  listJobBoard as _canonListJobBoard,
} from "@retainpdf/api/ai";
import { mockable } from "./_mockable.js";

export const askLibraryAi = mockable(_canonAskLibraryAi, MockAi.askLibraryAi);
export const readAiAskStream = _canonReadAiAskStream;
export const AiAskError = _CanonAiAskError;
// mock 里没有 agent，画板永远是空的。
export const listJobBoard = mockable(_canonListJobBoard, async () => ({ items: [] }));
export const jobBoardFileUrl = _canonJobBoardFileUrl;
