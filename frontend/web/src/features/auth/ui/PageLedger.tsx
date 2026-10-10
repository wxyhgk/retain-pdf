// 页数账目列表（新的在前，后端最多给 50 条）：「账户」看自己的，「账号管理」看某个账号的。
import type { PageLedgerEntry } from "@retainpdf/api/auth";
import { buildDetailUrl } from "@/platform/navigation/pages.js";
import { formatZhDateTime } from "@/platform/utils/datetime.js";
import { formatPageDelta, pageLedgerLabel, pageLedgerNote } from "../domain/page-ledger.js";

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatZhDateTime(date);
}

/** linkJobs：看别人的账目时传 false——管理员打不开别人的任务详情。 */
export function PageLedger({
  entries,
  emptyText = "还没有账目。",
  linkJobs = true,
}: {
  entries: PageLedgerEntry[];
  emptyText?: string;
  linkJobs?: boolean;
}) {
  if (!entries.length) return <p className="auth-sub" data-page-ledger-empty="true">{emptyText}</p>;
  return (
    <table className="auth-admin-table auth-ledger" data-page-ledger="true">
      <thead>
        <tr><th>时间</th><th>说明</th><th className="auth-ledger-delta">页数</th><th>备注</th></tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const note = pageLedgerNote(entry);
          // 删除退回的任务已经不在了，不给链接。
          const jobGone = entry.kind === "refund" && entry.note === "deleted";
          const jobUrl = linkJobs && entry.job_id && !jobGone ? buildDetailUrl(entry.job_id) : "";
          return (
            <tr key={entry.entry_id} data-ledger-kind={entry.kind}>
              <td>{when(entry.created_at)}</td>
              <td>{pageLedgerLabel(entry)}</td>
              <td className="auth-ledger-delta" data-positive={entry.delta > 0 ? "true" : "false"}>{formatPageDelta(entry.delta)}</td>
              <td>
                {jobUrl ? <a className="auth-link" href={jobUrl}>查看任务</a> : null}
                {note ? <span className="auth-ledger-note">{note}</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
