//! 服务商：OCR 服务商清单、各家的密钥校验和余额、翻译接口的模型列表。

use crate::app::AppState;
use crate::routes::providers;

crate::endpoints! {
    state: AppState;
    /// 能用的 OCR 服务商
    GET "/api/v1/providers/ocr" => providers::list_ocr_providers, signed;
    /// 校验 MinerU 的 token
    POST "/api/v1/providers/mineru/validate-token" => providers::validate_mineru_token, admin;
    /// 校验 Paddle 的 token
    POST "/api/v1/providers/paddle/validate-token" => providers::validate_paddle_token, admin;
    /// 校验 DeepSeek 的 API 密钥
    POST "/api/v1/providers/deepseek/validate-token" => providers::validate_deepseek_token, admin;
    /// 查 DeepSeek 余额
    POST "/api/v1/providers/deepseek/balance" => providers::query_deepseek_balance, admin;
    /// 从翻译接口拉取模型列表
    POST "/api/v1/providers/translation/models" => providers::list_translation_models, admin;
}
