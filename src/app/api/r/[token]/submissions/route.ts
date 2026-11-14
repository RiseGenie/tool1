import { z } from "zod";
import { NextResponse } from "next/server";
import { tx } from "@/lib/server/db";
import { clientIp, handle, HttpError, rateLimit } from "@/lib/server/http";
import { ALLOWED_MIME, MAX_REQUEST_BYTES, resolveRequest } from "@/lib/server/requests";

type Ctx = { params: Promise<{ token: string }> };
const schema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["screen", "camera", "upload"]),
  mimeType: z.string().transform((s) => s.split(";")[0].trim().toLowerCase()).refine((s) => ALLOWED_MIME.test(s), "Unsupported file type. Use a WebM, MP4 or MOV video."),
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  declaredSize: z.number().int().positive().optional(),
});

/** Start a submission (idempotent per id). Always routed to the request's owner, folder and request — never chosen by the guest. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const b = schema.parse(await req.json());
  rateLimit(`submit:${clientIp(req)}`, Number(process.env.REQUEST_SUBMIT_LIMIT_PER_HOUR || 10), 3_600_000);
  const r = await resolveRequest((await params).token);
  if (b.kind === "screen" && !r.allow_screen) throw new HttpError(403, "Screen recordings aren’t enabled for this request");
  if (b.kind === "camera" && !r.allow_camera) throw new HttpError(403, "Video replies aren’t enabled for this request");
  if (b.kind === "upload" && !r.allow_upload) throw new HttpError(403, "File uploads aren’t enabled for this request");
  if (b.declaredSize && b.declaredSize > MAX_REQUEST_BYTES) throw new HttpError(413, `That file is larger than the ${Math.round(MAX_REQUEST_BYTES / 1024 ** 2)} MB limit`, "too_large");

  const out = await tx(async (c) => {
    await c.query(`select id from video_requests where id=$1 for update`, [r.id]); // serialise the cap check
    const existing = (await c.query(`select id, request_id from recordings where id=$1`, [b.id])).rows[0];
    if (existing && existing.request_id !== r.id) throw new HttpError(409, "Id already in use");
    if (!existing) {
      const n = (await c.query(`select count(*)::int as n from recordings where request_id=$1 and (status <> 'uploading' or created_at > now() - interval '1 hour')`, [r.id])).rows[0].n;
      if (n >= r.max_submissions) throw new HttpError(409, "This request isn’t accepting more responses.", "full");
      await c.query(
        `insert into recordings(id, owner_id, folder_id, title, mime_type, request_id, submitter_name, submitter_email, submission_kind)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [b.id, r.owner_id, r.folder_id, `${r.title} — ${b.name}`, b.mimeType, r.id, b.name, b.email || null, b.kind],
      );
      await c.query(`insert into uploads(id, recording_id, owner_id, mime_type) values ($1,$1,$2,$3)`, [b.id, r.owner_id, b.mimeType]);
    }
    return (await c.query(`select idx, size_bytes::int as size from upload_chunks where upload_id=$1 order by idx`, [b.id])).rows;
  });
  return NextResponse.json({ recording: { id: b.id }, received: out });
});
