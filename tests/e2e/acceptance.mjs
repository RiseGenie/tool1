// Phase 1 acceptance test (Chromium, fake camera/mic, real tab capture, real upload/worker/FFmpeg/share flow).
// Run with scripts/e2e.sh, which starts Postgres, the app and the worker.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright-core");

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3200";
const OUT = process.env.E2E_OUT || "/tmp/rg-e2e";
const EXE = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const STORAGE = process.env.FS_STORAGE_DIR || "/tmp/rg-test-storage";
mkdirSync(OUT, { recursive: true });

let failures = 0;
const step = async (name, fn) => {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${r ? " — " + r : ""}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}\n      ${String(e.message).split("\n").slice(0, 12).join("\n      ")}`);
    throw e;
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const axeSrc = require.resolve("axe-core/axe.min.js");
async function axeScan(page, label) {
  await page.addScriptTag({ path: axeSrc });
  const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0].html.slice(0, 120) })));
  const bad = res.filter((v) => v.impact === "critical" || v.impact === "serious");
  if (bad.length) throw new Error(`${label}: ` + bad.map((v) => `${v.id} (${v.n}×, ${v.impact}) e.g. ${v.sample}`).join("\n      "));
  return `${label}: ${res.length} minor/moderate notes, 0 serious/critical`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-tab-capture-source-by-title=Capture Target", "--autoplay-policy=no-user-gesture-required"],
});

try {
  console.log("Acceptance test — RiseGenie Recorder, Phase 1");
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] });
  await ownerCtx.request.post(`${BASE}/api/dev-login`, { data: { email: "owner@example.com", name: "Olivia Owner" } });

  // A different tab to record, with something that visibly changes.
  const target = await ownerCtx.newPage();
  await target.setContent(`<title>Capture Target</title><body style="margin:0;background:#fff;font:64px sans-serif"><div id=t style="padding:40px"></div><script>let n=0;setInterval(()=>{t.textContent='Walkthrough tick '+(n++)},50)</script></body>`);

  const rec = await ownerCtx.newPage();
  const logs = [];
  rec.on("pageerror", (e) => logs.push("pageerror: " + e.message));
  rec.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) logs.push("console.error: " + m.text().slice(0, 200)); });
  await rec.addInitScript(() => { window.__RG_PART_BYTES = 150_000; });
  await rec.goto(`${BASE}/app/record`);

  await step("recorder shows capability list and capture options", async () => {
    await rec.getByRole("heading", { name: "What this browser can do" }).waitFor();
    await rec.getByText("Screen, window and tab capture").waitFor();
    for (const m of ["Screen + camera", "Screen only", "Camera only"]) await rec.getByText(m, { exact: true }).first().waitFor();
    await rec.locator("#mic").waitFor(); await rec.locator("#cam").waitFor();
    await rec.waitForFunction(() => document.querySelector('[role="meter"]'));
    await rec.screenshot({ path: `${OUT}/1-setup.png` });
    return await axeScan(rec, "recorder page a11y");
  });

  // Interrupt storage uploads: let exactly one part through, abort the rest.
  let puts = 0;
  await rec.route("**/api/storage/object**", (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    puts++;
    return puts === 1 ? route.continue() : route.abort("failed");
  });

  await step("start: countdown, recording indicator, elapsed time", async () => {
    await rec.getByRole("button", { name: "Start recording" }).click();
    await rec.getByRole("dialog", { name: "Recording starts soon" }).waitFor({ timeout: 15000 });
    await rec.getByRole("status").filter({ hasText: "REC" }).waitFor({ timeout: 15000 });
  });

  await step("record a different tab (camera + mic), pause and resume", async () => {
    await target.bringToFront();
    await sleep(3500);
    await rec.getByRole("button", { name: "Pause" }).click();
    await rec.getByText("PAUSED").waitFor();
    await sleep(500);
    const t1 = await rec.locator("[aria-label^='Elapsed']").getAttribute("aria-label");
    await sleep(1500);
    const t2 = await rec.locator("[aria-label^='Elapsed']").getAttribute("aria-label");
    expect(t1 === t2, `timer advanced while paused (${t1} -> ${t2})`);
    await rec.getByRole("button", { name: "Resume" }).click();
    await sleep(3500);
    return `timer ${await rec.locator("[aria-label^='Elapsed']").getAttribute("aria-label")}`;
  });

  let recId;
  await step("browser “Stop sharing” ends capture, saves, and releases all tracks", async () => {
    await rec.evaluate(() => {
      const e = window.__rg.engine;
      e.screen.getVideoTracks()[0].dispatchEvent(new Event("ended")); // what the browser fires on “Stop sharing”
    });
    await rec.getByText(/Upload/).first().waitFor({ timeout: 15000 });
    await sleep(500);
    const live = await rec.evaluate(() => window.__rg.engine.liveTrackCount());
    expect(live === 0, `${live} capture tracks still live`);
    recId = await rec.evaluate(
      () => new Promise((res) => {
        const r = indexedDB.open("rg-recorder");
        r.onsuccess = () => { const q = r.result.transaction("sessions").objectStore("sessions").getAll(); q.onsuccess = () => res(q.result[0].id); };
      }),
    );
    expect(!!recId, "no local session persisted");
    await rec.screenshot({ path: `${OUT}/2-uploading.png` });
  });

  await step("upload interrupted: server has only part of it", async () => {
    await sleep(3000);
    const r = await (await ownerCtx.request.get(`${BASE}/api/uploads/${recId}`)).json();
    expect(r.status === "open", "upload should still be open");
    expect(r.received.length >= 1, "first part should have arrived");
    return `server has ${r.received.length} part(s), ${puts} PUT attempts, finalize not reached`;
  });

  await step("reload (crash): local recovery offers the recording; resume uploads only what's missing", async () => {
    const before = (await (await ownerCtx.request.get(`${BASE}/api/uploads/${recId}`)).json()).received.length;
    await rec.unroute("**/api/storage/object**");
    await rec.reload();
    await rec.getByRole("region", { name: "Unsent recordings" }).waitFor({ timeout: 15000 });
    await rec.screenshot({ path: `${OUT}/3-recovery.png` });
    await rec.getByRole("button", { name: "Upload now" }).click();
    await rec.waitForURL(/\/app\/v\//, { timeout: 60000 });
    expect(rec.url().includes(recId), "redirected to the same recording (no duplicate)");
    const n = await (await ownerCtx.request.get(`${BASE}/api/recordings`)).json();
    expect(n.items.length === 1, `expected exactly 1 recording, found ${n.items.length}`);
    return `resumed from ${before} existing part(s)`;
  });

  await step("processing → ready; MP4 duration, thumbnail and transcript exist", async () => {
    await rec.getByText("Ready", { exact: true }).first().waitFor({ timeout: 120000 });
    const info = await (await ownerCtx.request.get(`${BASE}/api/recordings/${recId}`)).json();
    const d = info.recording.durationMs;
    expect(d > 5000 && d < 14000, `unexpected duration ${d}`);
    await rec.getByRole("tab", { name: /transcript/i }).click();
    await rec.getByRole("button", { name: /Welcome to the RiseGenie walkthrough/ }).first().waitFor({ timeout: 60000 });
    await rec.screenshot({ path: `${OUT}/4-ready.png` });
    return `duration ${(d / 1000).toFixed(1)}s; ` + (await axeScan(rec, "video page a11y"));
  });

  await step("camera overlay is composited into the saved video (sampled pixel)", async () => {
    const play = `${STORAGE}/recordings/${recId}/playback-r1.mp4`;
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", play]).toString());
    const v = probe.streams.find((s) => s.codec_type === "video");
    const a = probe.streams.find((s) => s.codec_type === "audio");
    expect(!!a, "mixed audio track missing");
    const x = Math.round(v.width * 0.09), y = Math.round(v.height * 0.86);
    const px = execFileSync("ffmpeg", ["-v", "error", "-ss", "2", "-i", play, "-frames:v", "1", "-vf", `crop=8:8:${x}:${y},scale=1:1`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    const [r, g, b] = px;
    // The target tab is white; a green-dominant pixel at the bubble position can only come from the fake camera.
    expect(g > r + 30 && g > b + 30, `pixel at bubble is rgb(${r},${g},${b}), not camera green`);
    return `${v.width}x${v.height}, h264+aac, bubble pixel rgb(${r},${g},${b})`;
  });

  await step("trim the recording (UI) and re-render", async () => {
    const before = (await (await ownerCtx.request.get(`${BASE}/api/recordings/${recId}`)).json()).recording.durationMs;
    await rec.getByRole("button", { name: "Save trim" }).waitFor();
    await rec.locator("#trim-start").fill("1500");
    await rec.getByRole("button", { name: "Save trim" }).click();
    await rec.getByText("Processing your video").waitFor({ timeout: 15000 });
    await rec.getByText("Ready", { exact: true }).first().waitFor({ timeout: 120000 });
    const after = (await (await ownerCtx.request.get(`${BASE}/api/recordings/${recId}`)).json()).recording.durationMs;
    expect(before - after > 1000 && before - after < 2200, `trim removed ${before - after}ms, expected ~1500`);
    return `${(before / 1000).toFixed(1)}s → ${(after / 1000).toFixed(1)}s`;
  });

  let link;
  await step("share: anyone-with-the-link, no download", async () => {
    await rec.getByLabel("Anyone with the link").check();
    const input = rec.locator('input[id^="url-"]');
    await input.waitFor();
    link = await input.inputValue();
    expect(/\/s\/[\w-]{20,}$/.test(link), `bad link ${link}`);
    return link.replace(/\/s\/.+/, "/s/…");
  });

  // ----- guest on a phone, no sign-in -----
  const phone = await browser.newContext({ ...devices["Pixel 7"] });
  const g = await phone.newPage();
  const token = link.split("/s/")[1];
  const gl = [];
  g.on("console", (m) => gl.push(`${m.type()}: ${m.text().slice(0, 160)}`));
  g.on("requestfailed", (r) => gl.push(`REQFAIL ${r.url().slice(0, 100)} ${r.failure()?.errorText}`));
  g.on("response", (r) => { if (r.url().includes("/api/")) gl.push(`${r.status()} ${r.request().method()} ${r.url().replace(/token=.*/, "").slice(0, 110)}`); });
  await step("phone guest (no account) opens the link and plays the video", async () => {
    await g.goto(link);
    await g.getByRole("button", { name: "Play video" }).waitFor({ timeout: 30000 });
    await g.getByRole("button", { name: "Play video" }).click();
    try {
      await g.waitForFunction(() => document.querySelector("video")?.currentTime > 1.2, null, { timeout: 15000 });
    } catch (e) {
      const st = await g.evaluate(() => { const v = document.querySelector("video"); return { paused: v.paused, rs: v.readyState, ns: v.networkState, t: v.currentTime, err: v.error && v.error.message, src: v.currentSrc.slice(0, 80), dur: v.duration }; });
      throw new Error("video state " + JSON.stringify(st) + "\n" + gl.slice(-12).join("\n"));
    }
    const info = await g.evaluate(() => { const v = document.querySelector("video"); return { w: v.videoWidth, d: v.duration, err: v.error?.code ?? null }; });
    expect(info.w > 0 && info.err === null, `video not playing ${JSON.stringify(info)}`);
    await g.screenshot({ path: `${OUT}/5-mobile-watch.png` });
    return `${info.w}px wide, duration ${info.d.toFixed(1)}s`;
  });

  await step("seek using the transcript", async () => {
    await g.getByRole("tab", { name: "transcript" }).click();
    const seg = g.getByRole("button", { name: /Here we enable the weekly report/ });
    await seg.waitFor({ timeout: 30000 });
    const ts = await seg.locator("span").first().innerText(); // e.g. 0:03
    const [m, s] = ts.split(":").map(Number);
    await g.evaluate(() => document.querySelector("video").pause()); // measure the seek itself, not playback after it
    await seg.click();
    await sleep(600);
    const t = await g.evaluate(() => document.querySelector("video").currentTime);
    expect(Math.abs(t - (m * 60 + s)) < 1.2, `seeked to ${t}, expected ~${m * 60 + s}`);
    await g.getByPlaceholder("Search transcript").fill("settings");
    expect((await g.getByRole("list").getByRole("button").count()) >= 1, "search returned nothing");
    return `jumped to ${t.toFixed(1)}s (${ts})`;
  });

  await step("keyboard: player responds to Space and arrow keys", async () => {
    await g.getByRole("group", { name: /Video player/ }).focus();
    await g.keyboard.press("Space");
    await sleep(300);
    const paused = await g.evaluate(() => document.querySelector("video").paused);
    const t0 = await g.evaluate(() => document.querySelector("video").currentTime);
    await g.keyboard.press("ArrowLeft");
    await sleep(300);
    const t1 = await g.evaluate(() => document.querySelector("video").currentTime);
    expect(t1 < t0, "ArrowLeft did not seek back");
    return `paused=${paused}`;
  });

  await step("guest leaves a timestamped comment; owner replies", async () => {
    await g.getByRole("tab", { name: /comments/ }).click();
    await g.getByLabel("Your name").fill("Casey Client");
    await g.getByLabel(/Comment at/).fill("Can we slow down on this part?");
    await g.getByRole("button", { name: "Post comment" }).click();
    await g.getByText("Can we slow down on this part?").waitFor();
    const cs = await (await phone.request.get(`${BASE}/api/share/${token}/comments`)).json();
    expect(cs.comments.length === 1 && cs.comments[0].author.verified === false, "comment not stored as unverified guest: " + JSON.stringify(cs));
    await g.screenshot({ path: `${OUT}/6-mobile-comment.png` });
    console.log("      " + (await axeScan(g, "guest page a11y")));
    // owner sees it in-app and replies
    await rec.reload();
    await rec.getByText("Can we slow down on this part?").waitFor();
    await rec.getByRole("button", { name: "Reply" }).click();
    await rec.getByLabel("Reply").fill("Sure — will re-record.");
    await rec.getByRole("button", { name: "Reply" }).last().click();
    await rec.getByText("Sure — will re-record.").waitFor();
  });

  await step("view counted once for the guest (≥3s of real playback)", async () => {
    await g.evaluate(() => document.querySelector("video").play());
    await sleep(4500);
    await g.evaluate(() => document.querySelector("video").pause()); // pausing flushes the watch time to the server
    await sleep(800);
    const r = (await (await ownerCtx.request.get(`${BASE}/api/recordings/${recId}`)).json()).recording;
    expect(r.viewCount === 1, `viewCount=${r.viewCount}`);
  });

  await step("revoke the link; a fresh guest session gets nothing and no media URL", async () => {
    rec.on("dialog", (d) => d.accept());
    await rec.getByRole("button", { name: "Revoke link" }).click();
    await rec.getByText(/All links were revoked/).waitFor();
    const fresh = await browser.newContext({ ...devices["Pixel 7"] });
    const fp = await fresh.newPage();
    const resp = await fp.goto(link);
    expect(resp.status() === 404, `page status ${resp.status()}`);
    await fp.getByText("This video isn’t available").waitFor();
    const media = await fresh.request.post(`${BASE}/api/share/${token}/media`);
    const meta = await fresh.request.get(`${BASE}/api/share/${token}`);
    const tr = await fresh.request.get(`${BASE}/api/share/${token}/transcript`);
    expect(media.status() === 404 && meta.status() === 404 && tr.status() === 404, `media ${media.status()}, meta ${meta.status()}, transcript ${tr.status()}`);
    await fp.screenshot({ path: `${OUT}/7-revoked.png` });
    await fresh.close();
  });

  if (logs.length) {
    failures++;
    console.log("  ✗ no page errors or hydration warnings\n      " + logs.join("\n      "));
  } else console.log("  ✓ no page errors or hydration warnings on the recorder/video pages");
  console.log(failures ? `\nFAILED (${failures})` : "\nAll acceptance steps passed.");
} catch (e) {
  console.log("\nStopped at first failure.");
  failures ||= 1;
} finally {
  await browser.close();
  process.exit(failures ? 1 : 0);
}
