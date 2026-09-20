//! 失败分类的**恢复目录**——新增一种失败时该改的地方。
//!
//! 背景：以前一种新失败要改三处——后端的检测分支、前端的判断分支、前端的文案。
//! 三处任何一处漏了，用户看到的就是「当前没有可识别的专门恢复状态。」——哪怕后端
//! 明明知道该怎么续跑。实测 15 个失败任务里有 7 个落在这个坑里。
//!
//! 现在前端不再认具体分类，只渲染后端给的东西。**新增一种失败 = 加一行下面的表。**
//!
//! 检测条件为什么不放进表里：各分类的判据形状不一样——有的是子串匹配、有的是 HTTP
//! 状态码、有的看 job 字段。硬塞成表会变成一个难读的小语言，得不偿失。表只负责
//! 「认出来之后怎么办」。

/// 失败后可以从哪个阶段续跑。`None` = 整个任务得重跑。
///
/// 这决定了用户会不会被重复收费：`Translation` 表示 OCR 产物完好，续跑不碰付费的
/// OCR 接口。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResumeFrom {
    /// OCR 产物完好，从翻译续跑。
    Translation,
    /// 翻译结果完好，只重跑渲染。
    Render,
}

impl ResumeFrom {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Translation => "translation",
            Self::Render => "render",
        }
    }
}

pub struct FailureRecovery {
    pub resume_from: Option<ResumeFrom>,
    /// 给用户的一句话：这次重试会做什么、要不要再花钱。
    pub hint: &'static str,
}

/// 分类 → 恢复方式。**新增失败类型就在这里加一行。**
///
/// 没登记的分类走 `unknown_recovery()`，行为是安全的保守值（整个重跑），
/// 所以漏登记不会让界面崩，只是恢复建议不够具体。
const CATALOGUE: &[(&str, FailureRecovery)] = &[
    // —— OCR 阶段就失败了：没有产物可复用，只能整个重跑 ——
    ("ocr_request_ambiguous", FailureRecovery {
        resume_from: None,
        hint: "OCR 请求结果不明确，重试前需确认重复执行风险（可能产生二次计费）。",
    }),
    ("auth_failed", FailureRecovery {
        resume_from: None,
        hint: "凭据无效或已过期。请在设置里更新后重试。",
    }),
    ("rate_limited", FailureRecovery {
        resume_from: None,
        hint: "上游服务限流。稍后重试即可，无需改动配置。",
    }),
    ("dns_resolution_failed", FailureRecovery {
        resume_from: None,
        hint: "解析上游域名失败，通常是网络问题。检查网络后重试。",
    }),
    ("upstream_timeout", FailureRecovery {
        resume_from: None,
        hint: "等待上游服务超时。文件可能已提交给服务方，重试会重新计费。",
    }),
    ("source_pdf_missing", FailureRecovery {
        resume_from: None,
        hint: "找不到源 PDF，任务无法继续。需要重新上传。",
    }),

    // —— OCR 已完成，失败在翻译：从翻译续跑，不重烧 OCR 的钱 ——
    ("placeholder_unstable", FailureRecovery {
        resume_from: Some(ResumeFrom::Translation),
        hint: "OCR 产物完好，从翻译阶段续跑，不会重复调用 OCR。",
    }),
    ("document_schema_validation_failed", FailureRecovery {
        resume_from: Some(ResumeFrom::Translation),
        hint: "标准化结果校验未通过。OCR 产物仍可复用，从翻译阶段续跑。",
    }),

    // —— 翻译已完成，只有渲染失败：只重跑渲染 ——
    ("render_failed", FailureRecovery {
        resume_from: Some(ResumeFrom::Render),
        hint: "翻译结果完好，只需重跑渲染，不会重复调用 OCR 或翻译接口。",
    }),
    ("typst_dependency_download_failed", FailureRecovery {
        resume_from: Some(ResumeFrom::Render),
        hint: "排版依赖下载失败，通常是网络问题。翻译结果完好，只需重跑渲染。",
    }),

    // —— 进程/内部错误：多为瞬时，整个重跑最稳 ——
    ("worker_process_missing", FailureRecovery {
        resume_from: None,
        hint: "执行进程在运行中消失（多为服务重启或崩溃）。可以直接重试。",
    }),
    ("process_timeout", FailureRecovery {
        resume_from: None,
        hint: "处理超时。可以直接重试。",
    }),
    ("process_exit_failed", FailureRecovery {
        resume_from: None,
        hint: "处理进程异常退出。可以直接重试。",
    }),
];

fn unknown_recovery() -> FailureRecovery {
    FailureRecovery {
        resume_from: None,
        // 故意保守：没登记过的分类不承诺「不会重复计费」。
        hint: "未识别的失败类型，重试会从头开始。",
    }
}

pub fn recovery_for(category: &str) -> FailureRecovery {
    CATALOGUE
        .iter()
        .find(|(key, _)| *key == category)
        .map(|(_, recovery)| FailureRecovery {
            resume_from: recovery.resume_from,
            hint: recovery.hint,
        })
        .unwrap_or_else(unknown_recovery)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_categories_map_to_their_resume_stage() {
        assert_eq!(recovery_for("render_failed").resume_from, Some(ResumeFrom::Render));
        assert_eq!(
            recovery_for("placeholder_unstable").resume_from,
            Some(ResumeFrom::Translation)
        );
        assert_eq!(recovery_for("auth_failed").resume_from, None);
    }

    /// 没登记的分类必须走保守兜底，而不是 panic 或谎称可以续跑。
    #[test]
    fn unknown_category_falls_back_conservatively() {
        let recovery = recovery_for("something-nobody-registered-yet");
        assert_eq!(recovery.resume_from, None);
        assert!(recovery.hint.contains("从头开始"));
    }

    /// 目录里不能有重复键——重复的话 `find` 只会命中第一条，后面那条静默失效。
    #[test]
    fn catalogue_has_no_duplicate_categories() {
        let mut seen = std::collections::HashSet::new();
        for (key, _) in CATALOGUE {
            assert!(seen.insert(*key), "目录里有重复的分类键：{key}");
        }
    }
}
