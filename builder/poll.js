// Polls the Firestore queue (xtg_builds) for new App Builder jobs from XTG AI phones and builds each one.
// No secrets: Firestore rules allow public read of the queue and status-only writes; the APK is published as a
// GitHub Release asset of THIS public repo using the workflow's own GITHUB_TOKEN.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { buildJob } = require("./build");

const PROJECT = process.env.FS_PROJECT || "test-media-app-3415";
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const API = `https://firestore.googleapis.com/v1/${DOCS}`;
const REPO = process.env.GITHUB_REPOSITORY;
const RUN_URL = `${process.env.GITHUB_SERVER_URL}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const POLL_SECONDS = Number(process.env.POLL_SECONDS || 240);
const DAILY_CAP = Number(process.env.DAILY_CAP || 60);
const STEPS = { claimed: 1, checking: 2, repairing: 2, preparing: 3, building: 4, signing: 5, publishing: 6, done: 7, failed: 7 };
const ONLY = process.env.ONLY_JOB || "";

const val = (f) => f == null ? undefined : f.stringValue ?? f.timestampValue ?? (f.integerValue != null ? Number(f.integerValue) : undefined);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fsFetch(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  if (!r.ok && r.status !== 404) throw new Error(`Firestore ${r.status}: ${t.slice(0, 300)}`);
  return r.status === 404 ? null : JSON.parse(t || "{}");
}

async function queued() {
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const q = { structuredQuery: { from: [{ collectionId: "xtg_builds" }],
    where: { fieldFilter: { field: { fieldPath: "createdAt" }, op: "GREATER_THAN", value: { timestampValue: since } } },
    orderBy: [{ field: { fieldPath: "createdAt" }, direction: "ASCENDING" }], limit: 20 } };
  const rows = await fsFetch(`${API}:runQuery`, { method: "POST", body: JSON.stringify(q) });
  return (rows || []).filter((r) => r.document).map((r) => {
    const f = r.document.fields || {};
    return { id: r.document.name.split("/").pop(), name: val(f.name), desc: val(f.desc), color: val(f.color), icon: val(f.icon), html: val(f.html), createdAt: val(f.createdAt) };
  });
}
async function getStatus(id) {
  const d = await fsFetch(`${API}/xtg_build_status/${id}`);
  if (!d) return null;
  const f = d.fields || {};
  return { stage: val(f.stage), at: val(f.at) };
}
async function setStatus(id, stage, msg, extra = {}) {
  const fields = { stage: { stringValue: stage }, step: { integerValue: String(STEPS[stage] || 0) }, total: { integerValue: "7" },
    msg: { stringValue: String(msg || "").slice(0, 280) }, runUrl: { stringValue: RUN_URL } };
  for (const [k, v] of Object.entries(extra)) fields[k] = { stringValue: String(v) };
  const body = { writes: [{ update: { name: `${DOCS}/xtg_build_status/${id}`, fields },
    updateTransforms: [{ fieldPath: "at", setToServerValue: "REQUEST_TIME" }] }] };
  try { await fsFetch(`${API}:commit`, { method: "POST", body: JSON.stringify(body) }); }
  catch (e) { console.log("status write failed:", e.message); }
  console.log(`[${id}] ${stage}: ${msg}`);
}
function gh(args) { return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function releaseExists(id) { try { gh(["release", "view", "b-" + id, "-R", REPO, "--json", "tagName"]); return true; } catch { return false; } }
function releasesLast24h() {
  try {
    const list = JSON.parse(gh(["api", `repos/${REPO}/releases?per_page=100`]));
    return list.filter((r) => Date.now() - Date.parse(r.created_at) < 24 * 3600e3).length;
  } catch { return 0; }
}

async function handle(job) {
  const st = await getStatus(job.id);
  if (st && (st.stage === "failed" || st.stage === "done")) return false;
  if (releaseExists(job.id)) return false;
  if (releasesLast24h() >= DAILY_CAP) { await setStatus(job.id, "failed", `আজকের সার্ভার সীমা (${DAILY_CAP}টি বিল্ড/২৪ ঘণ্টা) পূর্ণ — কাল আবার চেষ্টা করুন।`); return true; }
  await setStatus(job.id, "claimed", "ক্লাউড বিল্ড সার্ভার কাজটি নিয়েছে");
  const work = path.join(os.tmpdir(), "job-" + job.id);
  try {
    const r = await buildJob(job, work, (stage, msg) => setStatus(job.id, stage, msg));
    await setStatus(job.id, "publishing", "APK প্রকাশ করা হচ্ছে");
    const notes = `**${r.name}** — built by XTG AI App Builder (Protection By ISHAQ Officials)\n\n` +
      `- Package: \`${r.pkg}\`\n- Version: ${r.vn} (${r.vc})\n- SHA-256: \`${r.sha256}\`\n- Run: ${RUN_URL}\n\n` +
      "Signed with the public XTG Apps key (see keystore/README.md). Runs offline in a WebView, no internet permission.";
    const notesFile = path.join(work, "notes.md"); fs.writeFileSync(notesFile, notes);
    const htmlFile = path.join(work, "index.html"); fs.writeFileSync(htmlFile, r.html);
    gh(["release", "create", "b-" + job.id, r.apk, htmlFile, "-R", REPO, "--title", `${r.name} (${r.vn})`, "--notes-file", notesFile]);
    await setStatus(job.id, "done", "তৈরি হয়ে গেছে! ইনস্টল করুন", { asset: path.basename(r.apk), pkg: r.pkg, sha256: r.sha256, vn: r.vn });
  } catch (e) {
    console.error(e);
    await setStatus(job.id, "failed", "বিল্ড ব্যর্থ: " + String(e.message || e).split("\n")[0].slice(0, 200));
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
  return true;
}

(async () => {
  const end = Date.now() + POLL_SECONDS * 1000;
  const seen = new Set();
  do {
    let jobs = [];
    try { jobs = await queued(); } catch (e) { console.log("queue read failed:", e.message); }
    if (ONLY) jobs = jobs.filter((j) => j.id === ONLY);
    for (const j of jobs) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      if (!/^[a-z0-9]{12,40}$/.test(j.id) || !j.html) continue;
      await handle(j);
    }
    if (Date.now() < end) await sleep(20000);
  } while (Date.now() < end);
  console.log("poll window finished");
})();
