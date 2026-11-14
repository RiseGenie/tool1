// Phase 2d acceptance (UI): a client with no account responds to a video request three ways; owner receives them.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright-core");
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

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen"] });
try {
  console.log("Acceptance test — RiseGenie Recorder, Phase 2 (video requests)");
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ownerCtx.request.post(`${BASE}/api/dev-login`, { data: { email: "owner4@example.com", name: "Rita Requester" } });
  const owner = await ownerCtx.newPage();
  const errs = [];
  owner.on("pageerror", (e) => errs.push(e.message));
  let link;
  await step("owner creates a request link in the UI", async () => {
    await owner.goto(`${BASE}/app/requests`);
    await owner.getByLabel("What do you need?").fill("Show us the checkout bug");
    await owner.getByLabel("Instructions").fill("Record what happens when you press Pay.");
    await owner.getByRole("button", { name: "Create request link" }).click();
    const input = owner.locator('input[id^="ru-"]').first();
    await input.waitFor();
    link = await input.inputValue();
    expect(/\/r\/[\w-]{20,}$/.test(link), "bad link " + link);
    console.log("      " + (await axe(owner, "requests page a11y")));
  });

  const guestCtx = await browser.newContext({ ...devices["Pixel 7"], permissions: ["camera", "microphone"] });
  const g = await guestCtx.newPage();
  g.on("pageerror", (e) => errs.push("guest: " + e.message));
  await step("guest (no account) sees the request and must give a name", async () => {
    await g.goto(link);
    await g.getByRole("heading", { name: "Show us the checkout bug" }).waitFor({ timeout: 30000 });
    await g.getByText("Record what happens when you press Pay.").waitFor();
    console.log("      " + (await axe(g, "request page a11y")));
    await g.locator('input[type="file"]').setInputFiles({ name: "x.webm", mimeType: "video/webm", buffer: Buffer.from("x") });
    await g.getByText("Please enter your name first.").waitFor();
  });

  await step("a file that isn't a video is rejected (by content), nothing is stored", async () => {
    await g.getByLabel("Your name").fill("Gus Guest");
    await g.getByLabel(/Email/).fill("gus@client.com");
    await g.locator('input[type="file"]').setInputFiles({ name: "evil.mp4", mimeType: "video/mp4", buffer: Buffer.from("<html>not a video, just text pretending</html>".repeat(5)) });
    try { await g.getByRole("alert").filter({ hasText: /doesn.t look like a supported video/ }).waitFor({ timeout: 15000 }); }
    catch (e) { throw new Error("page shows: " + (await g.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 300)); }
    await g.reload();
  });

  await step("guest uploads a real video file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rg-e2e4-"));
    const f = join(dir, "bug.mp4");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=480x270:rate=25:duration=3", "-f", "lavfi", "-i", "sine=frequency=500:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", f]);
    await g.getByLabel("Your name").fill("Gus Guest");
    await g.locator('input[type="file"]').setInputFiles(f);
    await g.getByRole("heading", { name: /Thanks/ }).waitFor({ timeout: 60000 });
  });

  await step("guest records a video reply with their camera", async () => {
    await g.reload();
    await g.getByLabel("Your name").fill("Gina Guest");
    await g.getByRole("button", { name: "Record a video reply" }).click();
    await g.getByRole("status").filter({ hasText: "REC" }).waitFor({ timeout: 20000 });
    await sleep(2500);
    await g.getByRole("button", { name: /Stop & send/ }).click();
    await g.getByRole("heading", { name: /Thanks/ }).waitFor({ timeout: 60000 });
  });

  await step("owner sees both responses, routed to the request, and they process to ready", async () => {
    await owner.reload();
    await owner.getByRole("button", { name: /Responses \(2\)/ }).click();
    await owner.getByRole("link", { name: "Gus Guest" }).waitFor();
    await owner.getByRole("link", { name: "Gina Guest" }).waitFor();
    for (let i = 0; i < 60; i++) {
      const subs = (await (await ownerCtx.request.get(`${BASE}/api/recordings`)).json()).items;
      if (subs.length === 2 && subs.every((s) => s.status === "ready")) break;
      await sleep(1000);
    }
    const lib = (await (await ownerCtx.request.get(`${BASE}/api/recordings`)).json()).items;
    expect(lib.length === 2 && lib.every((s) => s.status === "ready" && s.fromRequest), "responses not ready/tagged: " + JSON.stringify(lib.map((s) => [s.status, s.fromRequest])));
    await owner.goto(`${BASE}/app`);
    await owner.getByText("From Gus Guest").waitFor();
    await owner.screenshot({ path: "/tmp/rg-e2e/9-library-requests.png" });
  });

  await step("closing the link stops the guest page immediately", async () => {
    await owner.goto(`${BASE}/app/requests`);
    await owner.getByRole("button", { name: "Close link" }).click();
    await owner.getByText("Closed", { exact: true }).waitFor();
    const fresh = await browser.newContext({ ...devices["Pixel 7"] });
    const p = await fresh.newPage();
    await p.goto(link);
    await p.getByRole("alert").filter({ hasText: /closed/i }).waitFor();
    await fresh.close();
  });

  if (errs.length) { failures++; console.log("  ✗ page errors: " + errs.join(" | ")); } else console.log("  ✓ no page errors");
  console.log(failures ? `\nFAILED (${failures})` : "\nAll Phase 2 request steps passed.");
} catch { failures ||= 1; } finally { await browser.close(); process.exit(failures ? 1 : 0); }
