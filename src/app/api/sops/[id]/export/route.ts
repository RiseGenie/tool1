import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { getOwned, linkToken } from "@/lib/server/recordings";
import { getOwnedSop, renderExport } from "@/lib/server/sops";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Markdown or Docs-ready HTML (upload to Google Drive → "Open with Google Docs"). Blocked until the author has marked the
 * SOP reviewed; any later edit clears that, so what's exported is always what was reviewed.
 */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const sop = await getOwnedSop((await params).id, s.userId);
  const rec = await getOwned(sop.recording_id, s.userId);
  if (sop.status !== "draft") throw new HttpError(409, "The draft isn’t ready yet");
  if (!sop.reviewed_at) throw new HttpError(409, "Review the SOP and mark it reviewed before exporting", "not_reviewed");
  const format = new URL(req.url).searchParams.get("format") === "html" ? "html" : "md";
  const base = process.env.APP_URL || new URL(req.url).origin;
  const link = (await query<{ token_enc: string }>(`select token_enc from share_links where recording_id = $1 and revoked_at is null order by created_at desc limit 1`, [rec.id]))[0];
  // Deep-link steps to the share page only when this exact version has an active link; otherwise show plain times.
  const body = await renderExport(sop, rec, format, link && rec.visibility === "link" ? `${base}/s/${linkToken(link)}` : null);
  const name = `${sop.title.replace(/[^\w\- ]+/g, "").trim() || "sop"}.${format === "html" ? "html" : "md"}`;
  return new Response(body, { headers: { "content-type": `${format === "html" ? "text/html" : "text/markdown"}; charset=utf-8`, "content-disposition": `attachment; filename="${name}"` } });
});
