// Phase 2e acceptance (UI): author a bug report, choose diagnostics, review the exact payload, submit once.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import http from "node:http";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const axeSrc = require.resolve("axe-core/axe.min.js");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3200";
const EXE = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
let failures = 0;
const step = async (name, fn) => { const t0 = Date.now(); try { const r = await fn(); console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${r ? " — " + r : ""}`); } catch (e) { failures++; console.log(`  ✗ ${name}\n      ${String(e.message).split("\n").slice(0, 8).join("\n      ")}`); throw e; } };
const expect = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function axe(page, label) {
  await page.addScriptTag({ path: axeSrc });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id}: ${x.nodes[0].html.slice(0, 100)}`));
  if (v.length) throw new Error(`${label}: ${v.join(" | ")}`);
  return `${label}: 0 serious/critical`;
}
const issues = [];
const tracker = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { issues.push(JSON.parse(b)); res.setHeader("content-type", "application/json"); res.statusCode = 201; res.end(JSON.stringify({ html_url: `https://github.com/acme/app/issues/${issues.length}` })); }); });
await new Promise((r) => tracker.listen(3299, "127.0.0.1", r));

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
try {
  console.log("Acceptance test — RiseGenie Recorder, Phase 2 (bug reports)");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.request.post(`${BASE}/api/dev-login`, { data: { email: "owner5@example.com", name: "Bea Reporter" } });
  const api = ctx.request;
  const recId = randomUUID();
  await step("setup: a ready recording to attach", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rg-e2e5-"));
    const f = join(dir, "f.webm");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=3", "-c:v", "libvpx", f]);
    const bytes = readFileSync(f);
    await api.post(`${BASE}/api/recordings`, { data: { id: recId, mimeType: "video/webm", title: "Checkout crash repro" } });
    const u = await (await api.post(`${BASE}/api/uploads/${recId}/chunks/0/url`)).json();
    await fetch(BASE + u.url, { method: "PUT", body: bytes });
    await api.post(`${BASE}/api/uploads/${recId}/chunks/0/complete`, { data: { size: bytes.length } });
    await api.post(`${BASE}/api/uploads/${recId}/finalize`, { data: { chunkCount: 1, totalBytes: bytes.length } });
    for (let i = 0; i < 60; i++) { if ((await (await api.get(`${BASE}/api/recordings/${recId}`)).json()).recording.status === "ready") return; await sleep(1000); }
    throw new Error("not ready");
  });

  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await step("author fills in the report and attaches the recording", async () => {
    await p.goto(`${BASE}/app/bug`);
    await p.getByRole("button", { name: "New bug report" }).click();
    await p.waitForURL(/\/app\/bug\/[0-9a-f-]{36}/);
    await p.getByLabel("Title").fill("Checkout crashes on Pay");
    await p.getByLabel("Steps to reproduce").fill("1. Add item\n2. Press Pay");
    await p.getByLabel("Expected behavior").fill("Order confirmation");
    await p.getByLabel("Actual behavior").fill("White screen");
    await p.getByLabel("Severity").selectOption("high");
    await p.getByLabel("Attach a recording").selectOption({ label: "Checkout crash repro" });
    console.log("      " + (await axe(p, "bug form a11y")));
  });

  await step("attachments: a real image is accepted; a disguised executable is rejected by content", async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 3)]);
    await p.locator('input[type="file"]').setInputFiles({ name: "crash.png", mimeType: "image/png", buffer: png });
    await p.getByText("crash.png").waitFor();
    await p.locator('input[type="file"]').setInputFiles({ name: "totally-a-photo.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(80, 7)]) });
    await p.getByRole("alert").filter({ hasText: /type isn.t allowed/ }).waitFor();
  });

  await step("diagnostics: the author chooses what is included", async () => {
    await p.getByRole("checkbox", { name: /Browser:/ }).uncheck();
    await p.getByRole("checkbox", { name: /Time zone:/ }).check();
    await sleep(900);
  });

  let preview;
  await step("preview shows exactly the selected data; submit needs explicit confirmation", async () => {
    await p.getByRole("button", { name: "Preview exactly what will be sent" }).click();
    const pre = p.getByLabel("Report preview");
    await pre.waitFor();
    preview = await pre.innerText();
    expect(/Steps to reproduce/.test(preview) && /White screen/.test(preview) && /crash\.png/.test(preview), "preview is missing content");
    expect(/Time zone/.test(preview) && !/\*\*Browser|Browser:/.test(preview), "diagnostic selection not respected: " + preview.slice(-300));
    expect(!/\/s\//.test(preview), "recording link must not appear unless opted in");
    const btn = p.getByRole("button", { name: "Submit report" });
    expect(await btn.isDisabled(), "submit should be disabled until the review box is ticked");
    console.log("      " + (await axe(p, "bug review a11y")));
    await p.getByLabel(/I.ve reviewed this/).check();
    await btn.click();
    await p.getByText(/This report is now read-only/).waitFor({ timeout: 15000 });
  });

  await step("exactly one issue reached the tracker, identical to the preview, with no extra data", async () => {
    expect(issues.length === 1, `issues filed: ${issues.length}`);
    expect(issues[0].title === "Checkout crashes on Pay" && issues[0].body === preview.replace(/\r/g, ""), "body differs from the preview");
    expect(!/Mozilla|HeadlessChrome/.test(issues[0].body), "user agent leaked although unchecked");
    expect(await p.getByLabel("Title").isDisabled(), "report should be read-only after submission");
    await p.screenshot({ path: "/tmp/rg-e2e/10-bug-submitted.png" });
  });

  if (errs.length) { failures++; console.log("  ✗ page errors: " + errs.join(" | ")); } else console.log("  ✓ no page errors");
  console.log(failures ? `\nFAILED (${failures})` : "\nAll Phase 2 bug-report steps passed.");
} catch { failures ||= 1; } finally { tracker.close(); await browser.close(); process.exit(failures ? 1 : 0); }
