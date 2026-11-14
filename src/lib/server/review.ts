import { query } from "./db";

export type Decision = {
  id: string; recording_id: string; revision: number; decision: "approved" | "changes_requested";
  reviewer_name: string; reviewer_email: string | null; verified: boolean; note: string | null; created_at: string;
};

/** Status of one version = its most recent decision; "pending" if none. Decisions never carry over to another version. */
export const statusOf = (ds: Pick<Decision, "decision">[]) => (ds.length ? ds[ds.length - 1].decision : "pending");

export const publicDecision = (d: Decision) => ({
  id: d.id, decision: d.decision, reviewerName: d.reviewer_name, reviewerEmail: d.verified ? d.reviewer_email : null,
  verified: d.verified, note: d.note, createdAt: d.created_at, revision: d.revision,
});

/** Review history for every non-draft (or, for owners, every) version of a series, oldest first. */
export async function reviewHistory(seriesId: string, opts: { includeDrafts: boolean }) {
  const versions = await query<{ id: string; version_no: number; version_label: string | null; created_at: string; is_draft: boolean; locked_at: string | null; status: string }>(
    `select id, version_no, version_label, created_at, is_draft, locked_at, status from recordings
      where series_id = $1 and deleted_at is null ${opts.includeDrafts ? "" : "and not is_draft"} order by version_no`,
    [seriesId],
  );
  const decisions = await query<Decision>(
    `select d.* from review_decisions d where d.recording_id = any($1) order by d.created_at`,
    [versions.map((v) => v.id)],
  );
  return versions.map((v) => {
    const ds = decisions.filter((d) => d.recording_id === v.id);
    return { id: v.id, versionNo: v.version_no, label: v.version_label, createdAt: v.created_at, isDraft: v.is_draft, locked: !!v.locked_at, status: statusOf(ds), decisions: ds.map(publicDecision) };
  });
}
