//! 合并计划：每个文档页取哪个任务的哪一页。纯函数，不碰磁盘、不认识 `JobSnapshot`。
//!
//! 输入只有两样：「谁更新」的排序键，和「输出 PDF 第 i 页是文档第几页」。从任务里把这两样
//! 读出来是 `sources` 的事；拿计划去拼是 `derived_artifacts::merged` 的事。

/// 「谁更新」的排序键，按字段顺序比较：`(产出者提交时间, 自己的完成时间, 自己的提交时间, job_id)`。
///
/// 规则的来由见 `merge_plan`。字段顺序就是比较顺序 —— 别调换。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct Rank {
    /// **产出这份译文的那个任务**的提交时间。render 任务（换字体重新排版）没有产出新译文，
    /// 这里是它的产出者的时间，不是它自己的。
    pub producer_created_at: String,
    /// 自己最后一次跑完的时间（没有记录时退回提交时间）。只在同一份译文的几个任务之间起作用：
    /// 原地精修、原地重排都会刷新它，最后排出来的那份 PDF 胜出。
    pub finished_at: String,
    pub created_at: String,
    pub job_id: String,
}

/// 一个参与合并的任务：它有多新，以及输出 PDF 第 `i` 页 = 文档第 `pages[i]` 页（1 起）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RankedPages {
    pub rank: Rank,
    pub pages: Vec<u32>,
}

/// 合并后某一文档页取自哪里。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum PageSource {
    /// 没有任何任务覆盖这一页：用源 PDF 的原文页。
    Original,
    /// 取 `job_id` 那个任务输出 PDF 的第 `local_index` 页（0 起）。
    Job { job_id: String, local_index: usize },
}

/// 合并计划：返回长度为 `document_page_count` 的向量，第 `k` 个元素是文档第 `k+1` 页的来源。
///
/// **整本长度**是刻意的：阅读器对照模式、双栏对照 PDF、Word 的字号回读都是**按页序号**
/// 配对原文和译文的。如果只把翻过的页紧凑地拼起来（第 1-5 页 + 第 20-25 页 → 11 页），
/// 这几处全部错页。没翻的页用原文填上。
///
/// # 「最新」的规则
///
/// 每页取覆盖它的任务里排序键最大的那个：`(产出者提交时间, 自己的完成时间, 自己的提交时间, job_id)`。
///
/// - **按产出者的提交时间，不按完成时间**：原地重新排版（`rerun.rs`）会保留 `created_at`
///   但清空 `finished_at` 再重写。按完成时间排，调一次字体就会让旧译文盖掉新译文。用户的
///   心智模型是「我最后一次发起翻译的那页胜出，重新排版不算重新翻译」。
/// - **同一份译文的多个任务**（产出者 + 它的 render 任务）里，**后跑完的**胜出 —— 那是更新的
///   排版。不能按提交时间：在原任务上原地精修（`retry-stage stage=refine`）或原地重排之后，
///   原任务的提交时间仍是最早的，按提交时间会让精修之前排的那份 PDF 一直赢，用户看不到精修。
///   完成时间只用在第二位，跨译文仍按产出者的提交时间（见上一条）。
/// - **job_id 兜底**：`now_iso()` 只精确到秒，混合范围拆成的子任务会在同一秒提交。它们彼此
///   不重叠所以不冲突，但排序必须确定。**不用 SQLite rowid**：`jobs` 表没有 INTEGER
///   PRIMARY KEY，VACUUM 可能重排 rowid。
pub(crate) fn merge_plan(document_page_count: u32, coverages: &[RankedPages]) -> Vec<PageSource> {
    let mut ranked: Vec<&RankedPages> = coverages.iter().collect();
    ranked.sort_by(|a, b| a.rank.cmp(&b.rank));
    let mut plan = vec![PageSource::Original; document_page_count as usize];
    // 从旧到新依次覆盖：最后写进去的就是最新的。
    for coverage in ranked {
        for (local_index, page) in coverage.pages.iter().enumerate() {
            let Some(slot) = (*page as usize)
                .checked_sub(1)
                .and_then(|index| plan.get_mut(index))
            else {
                // 越界的页号（比文档还长）直接跳过，不让一个坏任务拖垮整本合并。
                continue;
            };
            *slot = PageSource::Job {
                job_id: coverage.rank.job_id.clone(),
                local_index,
            };
        }
    }
    plan
}

#[cfg(test)]
mod tests {
    use super::{merge_plan, PageSource, Rank, RankedPages};

    fn cov(job_id: &str, created_at: &str, pages: &[u32]) -> RankedPages {
        RankedPages {
            rank: Rank {
                producer_created_at: created_at.to_string(),
                finished_at: created_at.to_string(),
                created_at: created_at.to_string(),
                job_id: job_id.to_string(),
            },
            pages: pages.to_vec(),
        }
    }

    fn job(id: &str, local: usize) -> PageSource {
        PageSource::Job { job_id: id.to_string(), local_index: local }
    }

    #[test]
    fn the_plan_is_always_full_document_length_with_untranslated_pages_original() {
        // 对照模式、双栏对照、Word 字号回读都按页序号配对 —— 必须整本长度。
        let plan = merge_plan(6, &[cov("a", "2026-10-01T00:00:00", &[2, 3])]);
        assert_eq!(plan.len(), 6, "合并结果不是整本长度");
        assert_eq!(
            plan,
            vec![
                PageSource::Original,
                job("a", 0),
                job("a", 1),
                PageSource::Original,
                PageSource::Original,
                PageSource::Original,
            ]
        );
    }

    #[test]
    fn the_latest_submission_wins_on_overlapping_pages() {
        // 先翻整本 1-5，再专门重翻 3-4：3-4 页用后者，其余用前者。
        let plan = merge_plan(
            5,
            &[
                cov("whole", "2026-10-01T00:00:00", &[1, 2, 3, 4, 5]),
                cov("redo", "2026-10-02T00:00:00", &[3, 4]),
            ],
        );
        assert_eq!(
            plan,
            vec![job("whole", 0), job("whole", 1), job("redo", 0), job("redo", 1), job("whole", 4)]
        );
    }

    #[test]
    fn input_order_does_not_change_the_result() {
        // 结果只能取决于「有哪些任务、谁先提交」，不能取决于数据库返回的顺序。
        let a = cov("whole", "2026-10-01T00:00:00", &[1, 2, 3]);
        let b = cov("redo", "2026-10-02T00:00:00", &[2]);
        assert_eq!(merge_plan(3, &[a.clone(), b.clone()]), merge_plan(3, &[b, a]));
    }

    #[test]
    fn local_index_follows_the_job_own_page_order() {
        // 第 6-10 页的任务：文档第 8 页是它输出 PDF 的第 2 页（0 起）。
        // 两层本地索引最容易在这里拼错。
        let plan = merge_plan(10, &[cov("mid", "2026-10-01T00:00:00", &[6, 7, 8, 9, 10])]);
        assert_eq!(plan[7], job("mid", 2), "文档第 8 页没有取 mid 的第 2 页");
        assert_eq!(plan[4], PageSource::Original, "文档第 5 页不该被覆盖");
    }

    #[test]
    fn a_relayout_keeps_its_producer_rank_so_it_cannot_overturn_a_newer_translation() {
        // 先翻整本（甲），再专门重翻第 2 页（乙），最后给甲换字体重新排版（render 任务丙）。
        // 丙没有产出新译文，按「产出者」甲的提交时间排 —— 第 2 页必须仍是乙。
        let whole = cov("whole", "2026-10-01T00:00:00", &[1, 2, 3]);
        let redo = cov("redo", "2026-10-02T00:00:00", &[2]);
        let mut relayout = cov("relayout", "2026-10-03T00:00:00", &[1, 2, 3]);
        relayout.rank.producer_created_at = whole.rank.created_at.clone();
        let plan = merge_plan(3, &[whole, redo, relayout]);
        assert_eq!(plan[1], job("redo", 0), "换个字体就让旧译文翻盘了");
        // 而第 1、3 页是同一份译文里更新的排版。
        assert_eq!(plan[0], job("relayout", 0));
        assert_eq!(plan[2], job("relayout", 2));
    }

    #[test]
    fn an_in_place_refine_beats_relayouts_that_finished_before_it() {
        // 原任务翻完后另建过几次重新排版；之后在原任务上原地精修（重写了它的 PDF）。
        // 同一份译文里按完成时间：原任务最后跑完，阅读必须打开它，不然看不到精修。
        let mut original = cov("original", "2026-10-06T13:38:13", &[1, 2]);
        original.rank.finished_at = "2026-10-09T17:00:00".to_string();
        let mut relayout = cov("relayout", "2026-10-09T06:35:45", &[1, 2]);
        relayout.rank.producer_created_at = original.rank.producer_created_at.clone();
        relayout.rank.finished_at = "2026-10-09T06:40:00".to_string();
        let plan = merge_plan(2, &[relayout.clone(), original.clone()]);
        assert_eq!(plan, vec![job("original", 0), job("original", 1)]);

        // 精修之后再排一次：那份更新，它胜出。
        relayout.rank.finished_at = "2026-10-09T18:00:00".to_string();
        let plan = merge_plan(2, &[relayout, original]);
        assert_eq!(plan, vec![job("relayout", 0), job("relayout", 1)]);
    }

    #[test]
    fn same_second_submissions_are_ordered_deterministically_by_job_id() {
        // now_iso() 只精确到秒。同一秒的两个任务覆盖同一页时，结果必须确定。
        let t = "2026-10-01T00:00:00";
        let plan = merge_plan(1, &[cov("job-b", t, &[1]), cov("job-a", t, &[1])]);
        assert_eq!(plan[0], job("job-b", 0), "同一秒提交时没有按 job_id 确定地兜底");
        let flipped = merge_plan(1, &[cov("job-a", t, &[1]), cov("job-b", t, &[1])]);
        assert_eq!(plan, flipped);
    }

    #[test]
    fn a_page_beyond_the_document_is_skipped_not_fatal() {
        let plan = merge_plan(2, &[cov("a", "2026-10-01T00:00:00", &[1, 2, 9])]);
        assert_eq!(plan, vec![job("a", 0), job("a", 1)]);
    }

    #[test]
    fn no_coverage_means_the_whole_document_is_original() {
        assert_eq!(merge_plan(3, &[]), vec![PageSource::Original; 3]);
    }
}
