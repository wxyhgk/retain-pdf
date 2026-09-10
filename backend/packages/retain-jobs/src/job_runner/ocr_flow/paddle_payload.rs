use serde_json::{json, Value};

const DEFAULT_PADDLE_TEMPERATURE: f64 = 0.0;

fn paddle_temperature() -> f64 {
    std::env::var("RUST_API_PADDLE_TEMPERATURE")
        .ok()
        .and_then(|value| value.trim().parse::<f64>().ok())
        .filter(|value| value.is_finite() && *value >= 0.0 && *value <= 2.0)
        .unwrap_or(DEFAULT_PADDLE_TEMPERATURE)
}

pub(super) fn build_paddle_optional_payload(model: &str, max_input_images: u16) -> Value {
    let normalized = model.trim().to_ascii_lowercase();
    if normalized.contains("pp-structurev3") {
        return json!({
            "max_num_input_imgs": max_input_images,
            "markdownIgnoreLabels": [
                "header",
                "header_image",
                "footer",
                "footer_image",
                "number",
                "footnote",
                "aside_text"
            ],
            "useChartRecognition": false,
            "useRegionDetection": true,
            "useDocOrientationClassify": false,
            "useDocUnwarping": false,
            "useTextlineOrientation": false,
            "useSealRecognition": true,
            "useFormulaRecognition": true,
            "useTableRecognition": true,
            "layoutThreshold": 0.5,
            "layoutNms": true,
            "layoutUnclipRatio": 1,
            "textDetLimitType": "min",
            "textDetLimitSideLen": 64,
            "textDetThresh": 0.3,
            "textDetBoxThresh": 0.6,
            "textDetUnclipRatio": 1.5,
            "textRecScoreThresh": 0,
            "sealDetLimitType": "min",
            "sealDetLimitSideLen": 736,
            "sealDetThresh": 0.2,
            "sealDetBoxThresh": 0.6,
            "sealDetUnclipRatio": 0.5,
            "sealRecScoreThresh": 0,
            "useTableOrientationClassify": true,
            "useOcrResultsWithTableCells": true,
            "useE2eWiredTableRecModel": false,
            "useE2eWirelessTableRecModel": false,
            "useWiredTableCellsTransToHtml": false,
            "useWirelessTableCellsTransToHtml": false,
            "parseLanguage": "default",
            "visualize": false
        });
    }

    json!({
        "max_num_input_imgs": max_input_images,
        "mergeLayoutBlocks": false,
        "markdownIgnoreLabels": [
            "header",
            "header_image",
            "footer",
            "footer_image",
            "number",
            "footnote",
            "aside_text"
        ],
        "useDocOrientationClassify": false,
        "useDocUnwarping": false,
        "useLayoutDetection": true,
        "useChartRecognition": false,
        "useSealRecognition": true,
        "useOcrForImageBlock": false,
        "mergeTables": true,
        "relevelTitles": true,
        "layoutShapeMode": "auto",
        "promptLabel": "ocr",
        "repetitionPenalty": 1,
        "temperature": paddle_temperature(),
        "topP": 1,
        "minPixels": 147384,
        "maxPixels": 2822400,
        "layoutNms": true,
        "restructurePages": true,
        "visualize": false
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_env<F>(key: &str, value: Option<&str>, f: F)
    where
        F: FnOnce(),
    {
        let prev = std::env::var(key).ok();
        match value {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
        f();
        match prev {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
    }

    #[test]
    fn paddle_optional_payload_sets_page_limit() {
        let payload = build_paddle_optional_payload("PaddleOCR-VL-1.5", 888);
        assert_eq!(payload["max_num_input_imgs"], 888);

        let structure_payload = build_paddle_optional_payload("PP-StructureV3", 777);
        assert_eq!(structure_payload["max_num_input_imgs"], 777);
    }

    #[test]
    fn paddle_temperature_env_override() {
        let _g = ENV_LOCK.lock().unwrap();
        with_env("RUST_API_PADDLE_TEMPERATURE", Some("0.7"), || {
            let payload = build_paddle_optional_payload("PaddleOCR-VL-1.5", 10);
            assert_eq!(payload["temperature"], 0.7);
        });
        with_env("RUST_API_PADDLE_TEMPERATURE", None, || {
            let payload = build_paddle_optional_payload("PaddleOCR-VL-1.5", 10);
            assert_eq!(payload["temperature"], 0.0);
        });
        with_env("RUST_API_PADDLE_TEMPERATURE", Some("bad"), || {
            let payload = build_paddle_optional_payload("PaddleOCR-VL-1.5", 10);
            assert_eq!(payload["temperature"], 0.0);
        });
    }
}
