import type { DeepSeekBalanceView, DeepSeekTokenValidationRequest, MineruTokenValidationRequest, PaddleTokenValidationRequest, ProviderProbeView } from "@retainpdf/contracts/provider-probes";
import { type RequestOptions } from "../request.js";
/** POST /api/v1/providers/mineru/validate-token */
export declare function validateMineruToken(apiPrefix: string | undefined, args: {
    body: MineruTokenValidationRequest;
}, options?: RequestOptions): Promise<ProviderProbeView>;
/** POST /api/v1/providers/paddle/validate-token */
export declare function validatePaddleToken(apiPrefix: string | undefined, args: {
    body: PaddleTokenValidationRequest;
}, options?: RequestOptions): Promise<ProviderProbeView>;
/** POST /api/v1/providers/deepseek/validate-token */
export declare function validateDeepSeekToken(apiPrefix: string | undefined, args: {
    body: DeepSeekTokenValidationRequest;
}, options?: RequestOptions): Promise<ProviderProbeView>;
/** POST /api/v1/providers/deepseek/balance */
export declare function queryDeepSeekBalance(apiPrefix: string | undefined, args: {
    body: DeepSeekTokenValidationRequest;
}, options?: RequestOptions): Promise<DeepSeekBalanceView>;
