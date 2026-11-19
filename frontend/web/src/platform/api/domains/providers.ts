import * as MockProviders from "../mocks/providers.js";
import {
  validateDeepSeekToken as _canonValidateDeepSeekToken,
  queryDeepSeekBalance as _canonQueryDeepSeekBalance,
  validatePaddleToken as _canonValidatePaddleToken,
  validateMineruToken as _canonValidateMineruToken,
  fetchTranslationProviderModels as _canonFetchTranslationProviderModels,
} from "@retainpdf/api/providers";
import { mockable } from "./_mockable.js";

export const validateDeepSeekToken = mockable(_canonValidateDeepSeekToken, MockProviders.validateDeepSeekToken);
export const queryDeepSeekBalance = mockable(_canonQueryDeepSeekBalance, MockProviders.queryDeepSeekBalance);
export const validatePaddleToken = mockable(_canonValidatePaddleToken, MockProviders.validatePaddleToken);
export const validateMineruToken = mockable(_canonValidateMineruToken, MockProviders.validateMineruToken);
export const fetchTranslationProviderModels = mockable(
  _canonFetchTranslationProviderModels,
  MockProviders.fetchTranslationProviderModels,
);
export type { ProviderModelListView, ProviderModelView } from "@retainpdf/api/providers";
