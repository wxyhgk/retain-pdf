//! 服务商：OCR 服务商清单、各家的错误码目录、各家的密钥校验和余额、翻译接口的模型列表、用翻译接口问一次模型（可带图片）。

use crate::app::AppState;
use crate::routes::providers;

crate::endpoints! {
    state: AppState;
    owner: providers;
    /// 能用的 OCR 服务商
    GET "/api/v1/providers/ocr" => providers::list_ocr_providers, signed by(none);
    /// 各家 OCR、翻译模型服务商的错误码目录（含义、给用户的提示、我们怎么处理），可按种类、厂商、码、HTTP 状态筛
    GET "/api/v1/providers/error-codes" => providers::list_provider_error_codes, signed by(none);
    /// 校验 MinerU 的 token
    POST "/api/v1/providers/mineru/validate-token" => providers::validate_mineru_token, admin by(web, cli);
    /// 校验 Paddle 的 token
    POST "/api/v1/providers/paddle/validate-token" => providers::validate_paddle_token, admin by(web, cli);
    /// 校验 DeepSeek 的 API 密钥
    POST "/api/v1/providers/deepseek/validate-token" => providers::validate_deepseek_token, admin by(web, cli);
    /// 查 DeepSeek 余额
    POST "/api/v1/providers/deepseek/balance" => providers::query_deepseek_balance, admin by(web, cli);
    /// 从翻译接口拉取模型列表
    POST "/api/v1/providers/translation/models" => providers::list_translation_models, admin by(web);
    /// 用翻译接口的配置问一次模型，可以带图片
    POST "/api/v1/providers/translation/ask" => providers::ask_translation_model, admin by(none) [large_body];
}
