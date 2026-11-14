// Phase 2 acceptance (UI): send review link -> request changes at a timestamp -> publish a redacted replacement -> approve that exact version.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright-core");
const axeSrc = require.resolve("axe-core/axe.min.js");

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3200";
const EXE = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
let failures = 0;
const step = async (name, fn) => {
  const t0 = Date.now();
  try { const r = await fn(); console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${r ? " — " + r : ""}`); }
  catch (e) { failures++; console.log(`  ✗ ${name}\n      ${String(e.message).split("\n").slice(0, 8).join("\n      ")}`); throw e; }
};
const expect = (c, m) => { if (!c) throw new Error(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function axe(page, label) {
  await page.addScriptTag({ path: axeSrc });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id}: ${x.nodes[0].html.slice(0, 100)}`));
  if (v.length) throw new Error(`${label}: ${v.join(" | ")}`);
  return `${label}: 0 serious/critical`;
}

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
try {
  console.log("Acceptance test — RiseGenie Recorder, Phase 2 (review, versions, privacy)");
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ownerCtx.request.post(`${BASE}/api/dev-login`, { data: { email: "owner3@example.com", name: "Olivia Owner" } });
  const api = ownerCtx.request;

  const id = randomUUID();
  await step("setup: upload a 6s recording through the API and wait for processing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rg-e2e2-"));
    const f = join(dir, "f.webm");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:v", "libvpx", "-c:a", "libopus", f]);
    const bytes = readFileSync(f);
    await api.post(`${BASE}/api/recordings`, { data: { id, mimeType: "video/webm", title: "Quarterly report walkthrough" } });
    const half = Math.ceil(bytes.length / 2);
    for (const [i, part] of [bytes.subarray(0, half), bytes.subarray(half)].entries()) {
      const u = await (await api.post(`${BASE}/api/uploads/${id}/chunks/${i}/url`)).json();
      await fetch(BASE + u.url, { method: "PUT", body: part });
      await api.post(`${BASE}/api/uploads/${id}/chunks/${i}/complete`, { data: { size: part.length } });
    }
    await api.post(`${BASE}/api/uploads/${id}/finalize`, { data: { chunkCount: 2, totalBytes: bytes.length } });
    for (let i = 0; i < 90; i++) { const r = (await (await api.get(`${BASE}/api/recordings/${id}`)).json()).recording; if (r.status === "ready" && r.transcriptStatus === "ready") return; await sleep(1000); }
    throw new Error("not ready");
  });

  const owner = await ownerCtx.newPage();
  const review = (p) => p.getByRole("region", { name: "Review", exact: true });
  const errs = [];
  owner.on("pageerror", (e) => errs.push(e.message));
  await owner.goto(`${BASE}/app/v/${id}`);
  let link;
  await step("owner shares an anyone-with-the-link review link", async () => {
    await owner.getByLabel("Anyone with the link").check();
    link = await owner.locator('input[id^="url-"]').inputValue();
    expect(/\/s\//.test(link), "no link");
  });

  const guestCtx = await browser.newContext({ ...devices["Pixel 7"] });
  const g = await guestCtx.newPage();
  await step("client requests changes at a timestamp from the share page", async () => {
    await g.goto(link);
    await g.getByRole("button", { name: "Request changes" }).waitFor({ timeout: 30000 });
    await g.getByRole("button", { name: "Request changes" }).click();
    await review(g).getByLabel("Your name").fill("Casey Client");
    await g.getByLabel("What should change?").fill("Please hide the settings screen");
    console.log("      " + (await axe(g, "review form a11y")));
    await g.getByRole("button", { name: "Submit" }).click();
    await g.getByRole("status").filter({ hasText: "Changes requested" }).first().waitFor();
    await g.getByText("Review history").waitFor();
  });

  await step("owner sees the change request, the version is locked, then resolves it", async () => {
    await owner.reload();
    await owner.getByText("Change requested").first().waitFor({ timeout: 15000 });
    await owner.getByText(/content is frozen/).waitFor();
    await owner.getByRole("button", { name: "Mark resolved" }).click();
    await owner.getByText("Change resolved").waitFor();
  });

  await step("owner creates a replacement draft and redacts it (blur + phrase)", async () => {
    await owner.getByRole("button", { name: "Create replacement version" }).click();
    await owner.waitForURL((u) => u.pathname.startsWith("/app/v/") && !u.pathname.endsWith(id), { timeout: 30000 });
    await owner.getByText("Draft — not visible to reviewers").waitFor();
    await owner.getByText("Ready", { exact: true }).first().waitFor({ timeout: 90000 });
    await owner.getByRole("button", { name: "Add blur at playhead" }).click();
    await owner.getByLabel("Word or phrase to redact").fill("settings");
    await owner.getByRole("button", { name: "Add", exact: true }).click();
    console.log("      " + (await axe(owner, "privacy panel a11y")));
    await owner.getByRole("button", { name: /Save & render sanitized version/ }).click();
    await owner.getByText("Processing your video").waitFor({ timeout: 15000 });
    await owner.getByText("Ready", { exact: true }).first().waitFor({ timeout: 120000 });
  });

  await step("before publishing, guests still get v1; after publishing they get v2 with no unredacted captions", async () => {
    await g.reload();
    await g.getByText(/Review — version 1/).waitFor();
    await owner.getByRole("button", { name: "Publish this version" }).click();
    await owner.getByText(/Published\./).waitFor();
    await g.reload();
    await g.getByText(/Review — version 2/).waitFor({ timeout: 30000 });
    await g.getByRole("status").filter({ hasText: "Awaiting review" }).first().waitFor();
    await g.getByRole("tab", { name: "transcript" }).click();
    await g.getByText("Welcome to the RiseGenie walkthrough").waitFor({ timeout: 30000 });
    const text = await g.locator("section[aria-label='Transcript and comments']").innerText();
    expect(!/settings/i.test(text) && /\[redacted\]/.test(text), "unredacted text visible to guest: " + text.slice(0, 200));
    const vtt = await (await guestCtx.request.get(`${link.replace("/s/", "/api/share/")}/captions`)).text();
    expect(!/settings/i.test(vtt), "unredacted captions served");
    // the earlier decision stays in history, attached to v1
    await g.getByRole("tab", { name: /comments/ }).click();
    await g.getByText(/v1 · Changes requested by Casey Client/).waitFor();
  });

  await step("client approves exactly this version; the version is then frozen", async () => {
    await g.getByRole("button", { name: "Approve this version" }).click();
    await review(g).getByLabel("Your name").fill("Casey Client");
    await g.getByRole("button", { name: "Submit" }).click();
    await g.getByRole("status").filter({ hasText: /^Approved$/ }).first().waitFor();
    await g.getByText(/v2 · Approved by Casey Client/).waitFor();
    await owner.reload();
    await owner.getByText(/content is frozen/).waitFor();
    await owner.getByText(/Unavailable while processing, or because this version is locked/).waitFor();
    await g.screenshot({ path: "/tmp/rg-e2e/8-review.png" });
  });

  await step("SOP from the approved version: generate, edit, review gate, export", async () => {
    const vurl = owner.url().split("?")[0];
    await owner.goto(`${vurl}/sop`);
    await owner.getByRole("button", { name: "Generate SOP draft" }).click();
    await owner.getByLabel("Step 1 title").waitFor({ timeout: 60000 });
    await owner.getByAltText("Screenshot for step 1").waitFor();
    const texts = await owner.locator("ol").innerText().catch(() => "");
    expect(!/settings/i.test(await owner.locator("main").innerText() + (await owner.locator("textarea, input").evaluateAll((els) => els.map((e) => e.value).join(" ")))), "redacted words leaked into the SOP");
    await owner.getByLabel("Step 1 title").fill("Open the dashboard");
    await owner.getByLabel("Step 1 title").blur();
    await owner.getByRole("heading", { level: 1 }).waitFor();
    expect(await owner.getByRole("link", { name: "Export Markdown" }).getAttribute("aria-disabled") === "true", "export should be locked before review");
    await owner.getByRole("button", { name: "I’ve reviewed this SOP" }).click();
    await owner.getByText("Marked as reviewed").waitFor();
    console.log("      " + (await axe(owner, "SOP page a11y")));
    const [dl] = await Promise.all([owner.waitForEvent("download"), owner.getByRole("link", { name: "Export Markdown" }).click()]);
    const path = await dl.path();
    const md = readFileSync(path, "utf8");
    expect(/^# /.test(md) && /## Step 1: Open the dashboard/.test(md) && /data:image\/jpeg;base64,/.test(md), "markdown export malformed");
    return dl.suggestedFilename();
  });

  if (errs.length) { failures++; console.log("  ✗ page errors: " + errs.join(" | ")); } else console.log("  ✓ no page errors");
  console.log(failures ? `\nFAILED (${failures})` : "\nAll Phase 2 review/privacy steps passed.");
} catch { failures ||= 1; } finally { await browser.close(); process.exit(failures ? 1 : 0); }
