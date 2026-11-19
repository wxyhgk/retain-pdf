// 生成文件，不要手改。来源：contracts/translation-providers.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  TranslationModelListView,
  TranslationModelsRequest,
} from "@retainpdf/contracts/translation-providers";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** POST /api/v1/providers/translation/models */
export function listTranslationProviderModels(
  apiPrefix: string | undefined,
  args: { body: TranslationModelsRequest },
  options?: RequestOptions,
): Promise<TranslationModelListView> {
  return request<TranslationModelListView>({ apiPrefix, method: "POST", path: `providers/translation/models`, body: args.body, options });
}
