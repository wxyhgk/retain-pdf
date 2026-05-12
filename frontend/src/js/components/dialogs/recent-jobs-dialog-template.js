export function recentJobsDialogTemplate() {
  return `
    <dialog id="query-dialog" class="desktop-dialog recent-jobs-dialog">
      <form method="dialog" class="desktop-shell recent-jobs-dialog-shell">
        <div class="recent-jobs-sidebar-head">
          <div class="recent-jobs-head">
            <h2>最近任务</h2>
            <p>按最近更新时间排序，点击后直接切换到该任务。</p>
          </div>
          <button id="query-dialog-close-btn" type="submit" class="dialog-close-btn" aria-label="关闭">×</button>
        </div>
        <div class="recent-jobs-sidebar-body">
          <div class="recent-jobs-toolbar">
            <input id="recent-jobs-date" type="date" aria-label="选择日期" />
            <button id="refresh-jobs-btn" class="secondary" type="button">刷新列表</button>
          </div>
          <div id="recent-jobs-summary" class="status-panel-note">Stage Spec 0 · Legacy CLI 0 · Unknown 0</div>
          <div id="recent-jobs-empty" class="events-empty hidden">暂无最近任务</div>
          <div id="recent-jobs-list" class="recent-jobs-list hidden"></div>
          <div class="recent-jobs-more-row">
            <button id="load-more-jobs-btn" class="secondary hidden" type="button">更多</button>
          </div>
        </div>
      </form>
    </dialog>
  `;
}
