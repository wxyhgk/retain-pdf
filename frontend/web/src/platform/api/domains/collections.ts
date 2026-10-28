import * as MockCollections from "../mocks/collections.js";
import {
  listCollections as _canonListCollections,
  createCollection as _canonCreateCollection,
  patchCollection as _canonPatchCollection,
  deleteCollection as _canonDeleteCollection,
  addDocumentsToCollection as _canonAddDocumentsToCollection,
  removeDocumentFromCollection as _canonRemoveDocumentFromCollection,
  materializeCollectionWorkspace as _canonMaterializeCollectionWorkspace,
} from "@retainpdf/api/collections";
import { mockable } from "./_mockable.js";

export const listCollections = mockable(_canonListCollections, MockCollections.listCollections);
export const createCollection = mockable(_canonCreateCollection, MockCollections.createCollection);
export const patchCollection = mockable(_canonPatchCollection, MockCollections.patchCollection);
export const deleteCollection = mockable(_canonDeleteCollection, MockCollections.deleteCollection);
export const addDocumentsToCollection = mockable(_canonAddDocumentsToCollection, MockCollections.addDocumentsToCollection);
export const removeDocumentFromCollection = mockable(_canonRemoveDocumentFromCollection, MockCollections.removeDocumentFromCollection);
// mock 里没有终端，也没有翻译好的书可以物化。
export const materializeCollectionWorkspace = mockable(_canonMaterializeCollectionWorkspace, async () => ({ books: [] }));
