import { NextResponse } from "next/server";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { one } from "@/lib/server/db";
import { handle, HttpError, rateLimit } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwnedBug } from "@/lib/server/bugs";
import { getStorage } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string }> };
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

/** Content-sniffed allow-list: the declared type and extension are never trusted on their own. */
function sniff(buf: Buffer): { mime: string; ext: string } | null {
  const h = (...b: number[]) => b.every((v, i) => buf[i] === v);
  if (h(0x89, 0x50, 0x4e, 0x47)) return { mime: "image/png", ext: "png" };
  if (h(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (h(0x47, 0x49, 0x46, 0x38)) return { mime: "image/gif", ext: "gif" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  // Plain text (logs, JSON, .txt): valid UTF-8, no NUL bytes, no executable/HTML markers.
  const exe = h(0x4d, 0x5a) || h(0x7f, 0x45, 0x4c, 0x46) || h(0xfe, 0xed, 0xfa) || h(0xcf, 0xfa, 0xed, 0xfe) || h(0x50, 0x4b, 0x03, 0x04); // PE, ELF, Mach-O, ZIP/JAR
  if (buf.length && !exe) {
    try {
      const t = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      // Real text has no control characters other than tab / newline / carriage return.
      if (!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t) && !/^\s*(<\s*(!doctype|html|script|svg)|#!)/i.test(t)) return { mime: "text/plain", ext: "txt" };
    } catch { /* not text */ }
  }
  return null;
}

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = await getOwnedBug((await params).id, s.userId);
  if (b.status === "submitted" || b.status === "submitting") throw new HttpError(409, "This report was already submitted");
  rateLimit(`bug-att:${s.userId}`, 30, 60_000);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a file");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Files can be at most 10 MB", "too_large");
  const n = (await one<{ n: number }>(`select count(*)::int as n from bug_attachments where report_id=$1`, [b.id]))!.n;
  if (n >= MAX_FILES) throw new HttpError(409, `At most ${MAX_FILES} attachments per report`);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) throw new HttpError(415, "That file type isn’t allowed. Use an image, PDF, or a plain-text log.", "bad_type");
  const id = randomUUID();
  const key = `bugs/${b.id}/${id}.${kind.ext}`;
  const dir = await mkdtemp(join(tmpdir(), "rg-bug-"));
  try {
    await writeFile(join(dir, "f"), buf);
    await getStorage().uploadFrom(join(dir, "f"), key, kind.mime);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const name = (file.name || "file").replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  await one(`insert into bug_attachments(id, report_id, filename, mime_type, size_bytes, storage_key) values ($1,$2,$3,$4,$5,$6)`, [id, b.id, name, kind.mime, buf.length, key]);
  return NextResponse.json({ id }, { status: 201 });
});
