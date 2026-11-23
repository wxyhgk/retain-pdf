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
//!
//! **分类有两个产生方，两边的取值都得在这张表里登记：**
//!
//! 1. Python 流水线——`backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py`
//!    里的 `error_type`。worker 会把它打成一行 `structured failure json:`，
//!    `classify_job_failure_inner` 解析到就**直接返回**，Rust 侧的检测分支一行都不跑。
//!    所以实际生效的多半是这一份。
//! 2. Rust 分类器——`job_failure.rs` 里那些子串/状态码分支，只在结构化 JSON 缺失时兜底。
//!
//! 这张表最初只照着第 2 份写，于是第 1 份的 7 个取值全在吃兜底文案。
//! `check_failure_catalogue_covers_python_codes`（架构门禁）现在会挡住这种漂移。

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
    ("typst_runtime_failed", FailureRecovery {
        resume_from: Some(ResumeFrom::Render),
        // 不能只说「重跑渲染就行」：typst 缺失是环境问题，不先装好就重跑必然再失败一次。
        hint: "typst 可执行文件缺失或无法启动。翻译结果完好、重跑渲染不会重复计费，\
               但要先装好 typst（或设置 TYPST_BIN）再重试，否则会再失败一次。",
    }),

    // —— 进程/内部错误：多为瞬时，整个重跑最稳 ——
    ("worker_process_missing", FailureRecovery {
        resume_from: None,
        hint: "执行进程在运行中消失（多为服务重启或崩溃）。可以直接重试。",
    }),
    // 启动恢复 / 运行期巡检的崩溃循环熔断（runner 的 MAX_AUTO_RESUMES_WITHOUT_PROGRESS）。
    ("auto_resume_limit_exceeded", FailureRecovery {
        resume_from: None,
        hint: "任务多次自动续跑都没有进展就又中断了，疑似这份输入让服务崩溃，已停止自动续跑。\
               请先查看失败详情里的日志，排查后再手动重试。",
    }),
    ("process_timeout", FailureRecovery {
        resume_from: None,
        hint: "处理超时。可以直接重试。",
    }),
    ("process_exit_failed", FailureRecovery {
        resume_from: None,
        hint: "处理进程异常退出。可以直接重试。",
    }),
    ("python_unhandled_exception", FailureRecovery {
        resume_from: None,
        // 这是 structured_errors.py 的兜底取值，能落到这里说明没命中任何具体判据，
        // 阶段产物是否可用无从判断，只能保守。
        hint: "流水线抛出了未归类的异常。请查看失败详情里的日志，重试会从头开始。",
    }),

    // —— Python 侧的上游失败：与上面 Rust 侧的同义分类一一对应 ——
    ("upstream_rate_limited", FailureRecovery {
        resume_from: None,
        hint: "上游服务限流。稍后重试即可，无需改动配置。",
    }),
    ("upstream_quota_exhausted", FailureRecovery {
        resume_from: None,
        hint: "上游账户余额不足或欠费，充值前重试会同样失败。请先充值或检查账户额度，重试会从头开始。",
    }),
    ("upstream_bad_request", FailureRecovery {
        resume_from: None,
        hint: "上游服务拒绝了请求（400），重试通常无效。请检查模型配置与请求参数。",
    }),

    // —— 翻译阶段的具体失败：OCR 产物完好，从翻译续跑 ——
    ("translation_request_ambiguous", FailureRecovery {
        resume_from: Some(ResumeFrom::Translation),
        hint: "重启时有已发出但结果不明的翻译请求，已暂停自动续跑。确认可接受重复请求（可能重复计费）后，从翻译阶段重试。",
    }),
    ("translation_protocol_shell", FailureRecovery {
        resume_from: Some(ResumeFrom::Translation),
        hint: "翻译模型返回了协议或 JSON 外壳而非译文。OCR 产物完好，从翻译阶段续跑。",
    }),
    ("json_decode_failed", FailureRecovery {
        resume_from: Some(ResumeFrom::Translation),
        hint: "模型返回的 JSON 无法解析。OCR 产物完好，从翻译阶段续跑，不会重复调用 OCR。",
    }),

    // —— 源文件本身有问题：换文件，重试无意义 ——
    ("source_pdf_open_failed", FailureRecovery {
        resume_from: None,
        hint: "源 PDF 无法打开，可能已损坏或不是有效的 PDF。重试无效，需要重新上传。",
    }),

    // —— 本机环境（2026-11-23）：和上游、文档内容无关，原样重试多半还会失败，先按提示处理 ——
    // 两边都会产生：Python 按异常类型认，Rust 兜底按文字认（job_failure_fallback.rs）。
    ("out_of_memory", FailureRecovery {
        resume_from: None,
        hint: "处理这份文档时内存不够用。先关掉其他占内存的程序，或把 PDF 拆成页数更少的几份分别翻译；重试会从头开始。",
    }),
    ("runtime_environment_broken", FailureRecovery {
        resume_from: None,
        hint: "安装包缺文件或依赖库加载失败，重试不会好转。请升级到最新版或重新安装 RetainPDF（Docker 请拉取最新镜像）后再试。",
    }),
    ("path_too_long", FailureRecovery {
        resume_from: None,
        hint: "文件路径超过了系统允许的长度（Windows 默认约 260 个字符）。把 PDF 改个短一点的文件名、或放到层级浅的目录后重新上传；\
               也可以在 Windows 里开启长路径支持后重试。",
    }),
    ("local_permission_denied", FailureRecovery {
        resume_from: None,
        hint: "本机拒绝了文件或网络访问。请检查杀毒或安全软件是否拦截了 RetainPDF（可加入白名单）、文件是否被其他程序占用、\
               安装目录和数据目录是否可写；Windows 上可以试试以管理员身份运行，处理后重试。",
    }),
];

/// 同一种分类在不同阶段恢复方式不同时，按 (分类, 失败阶段) 覆盖上面的表。
///
/// 只登记"换个阶段就能少花钱"的情况。例如 `auth_failed`：OCR 阶段的 Key 被拒，
/// 没有产物可复用，只能整个重跑；翻译阶段的 Key 被拒（翻译会在第一次被拒时整份停下），
/// OCR 已经完整做完，换 Key 后从翻译续跑就行。
const STAGE_OVERRIDES: &[(&str, &str, FailureRecovery)] = &[
    ("auth_failed", "translation", FailureRecovery {
        resume_from: Some(ResumeFrom::Translation),
        hint: "翻译 API Key 无效或没有权限。OCR 产物完好，在设置里换 Key 后从翻译阶段续跑，不会重复调用 OCR。",
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

/// 恢复目录里登记过的全部分类（2026-11-23，服务商错误码目录用它核对自己的失败码表）。
pub fn catalogued_failure_codes() -> impl Iterator<Item = &'static str> {
    CATALOGUE.iter().map(|(key, _)| *key)
}

/// 按分类和失败阶段查恢复方式：先查 `STAGE_OVERRIDES`，没有再按分类查表。
pub fn recovery_for_stage(category: &str, failed_stage: &str) -> FailureRecovery {
    let failed_stage = failed_stage.trim();
    STAGE_OVERRIDES
        .iter()
        .find(|(key, stage, _)| *key == category && *stage == failed_stage)
        .map(|(_, _, recovery)| FailureRecovery {
            resume_from: recovery.resume_from,
            hint: recovery.hint,
        })
        .unwrap_or_else(|| recovery_for(category))
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

    /// 翻译阶段的 Key 被拒：OCR 已经做完，换 Key 后从翻译续跑，不该让用户重付 OCR 的钱。
    /// OCR 阶段（或阶段不明）的 Key 被拒照旧整个重跑。
    #[test]
    fn auth_failure_resumes_at_translation_only_when_it_failed_in_translation() {
        let translation = recovery_for_stage("auth_failed", "translation");
        assert_eq!(translation.resume_from, Some(ResumeFrom::Translation));
        assert!(translation.hint.contains("换 Key"));
        for stage in ["ocr_processing", "ocr", "normalization", "", "startup_recovery"] {
            assert_eq!(
                recovery_for_stage("auth_failed", stage).resume_from,
                None,
                "{stage} 阶段的 Key 被拒没有可复用的 OCR 产物"
            );
        }
        // 没有覆盖的分类照旧按表查
        assert_eq!(
            recovery_for_stage("render_failed", "translation").resume_from,
            Some(ResumeFrom::Render)
        );
    }

    /// 覆盖表里的分类必须先在主表登记——否则其他阶段会落到「未识别」兜底文案。
    #[test]
    fn stage_overrides_refer_to_catalogued_categories() {
        for (category, stage, _) in STAGE_OVERRIDES {
            assert!(
                CATALOGUE.iter().any(|(key, _)| key == category),
                "覆盖表里的 {category}（{stage}）没有在主表登记"
            );
        }
    }

    /// 没登记的分类必须走保守兜底，而不是 panic 或谎称可以续跑。
    #[test]
    fn unknown_category_falls_back_conservatively() {
        let recovery = recovery_for("something-nobody-registered-yet");
        assert_eq!(recovery.resume_from, None);
        assert!(recovery.hint.contains("从头开始"));
    }

    /// typst 缺失是环境问题：翻译产物完好可以只重跑渲染，但提示不能只说
    /// 「重跑就行」——不先装好 typst，重跑必然再失败一次。
    #[test]
    fn missing_typst_binary_resumes_at_render_without_promising_a_fix() {
        let recovery = recovery_for("typst_runtime_failed");
        assert_eq!(recovery.resume_from, Some(ResumeFrom::Render));
        assert!(recovery.hint.contains("不会重复计费"));
        assert!(recovery.hint.contains("TYPST_BIN"));
    }

    /// 限流在两个产生方有两个名字：Rust 侧 `rate_limited`、Python 侧
    /// `upstream_rate_limited`。少登记一个，那一侧就吃兜底文案。
    #[test]
    fn both_spellings_of_rate_limiting_are_registered() {
        for category in ["rate_limited", "upstream_rate_limited"] {
            let recovery = recovery_for(category);
            assert_eq!(recovery.resume_from, None);
            assert!(
                recovery.hint.contains("限流"),
                "{category} 落到了兜底文案"
            );
        }
    }

    /// 承诺「不重复调用 OCR」的，必须真的是从翻译或渲染续跑——否则就是在骗用户。
    #[test]
    fn hints_promising_no_ocr_recharge_actually_resume_past_ocr() {
        let overrides = STAGE_OVERRIDES
            .iter()
            .map(|(category, _, recovery)| (*category, recovery));
        for (category, recovery) in CATALOGUE.iter().map(|(c, r)| (*c, r)).chain(overrides) {
            if recovery.hint.contains("不会重复调用 OCR") {
                assert!(
                    recovery.resume_from.is_some(),
                    "{category} 承诺不重跑 OCR，但 resume_from 是 None（会从头开始）"
                );
            }
        }
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
