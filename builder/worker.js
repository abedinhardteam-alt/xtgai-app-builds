// Always-on dispatcher for the XTG App Builder (Protection By ISHAQ Officials).
// Runs inside .github/workflows/worker.yml for up to ~5h45m, checks the Firestore queue every ~20 s, atomically
// claims each new job and starts a SEPARATE build.yml run for it (so several apps can build in parallel), then
// the workflow re-dispatches itself. The */5 cron in build.yml and the weekly keepalive restart it if it ever dies.
// No secrets: public Firestore reads + rule-limited status writes, and the workflow's own GITHUB_TOKEN.
const { queued, newestCursor, getStatus, claim, setStatus, releaseExists, gh, STALE_MS, REPO } = require("./poll");

const RUN_SECONDS = Number(process.env.WORKER_SECONDS || 20700);   // 5h45m (job limit is 6h)
const EVERY_MS = Number(process.env.WORKER_EVERY_MS || 20000);
const REF = process.env.GITHUB_REF_NAME || "main";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString();

function dispatch(id) {
  gh(["workflow", "run", "build.yml", "-R", REPO, "--ref", REF, "-f", "job=" + id]);
}

async function consider(job) {
  if (!/^[a-z0-9]{12,40}$/.test(job.id) || !job.html) return;
  const st = await getStatus(job.id);
  if (st && (st.stage === "done" || st.stage === "failed")) return;
  if (st && Date.now() - Date.parse(st.at || 0) < STALE_MS) return;        // already being built
  if (releaseExists(job.id)) return;
  if (!st) { if (!(await claim(job.id, "ক্লাউড সার্ভার কাজটি নিয়েছে — বিল্ড শুরু হচ্ছে"))) return; }
  else await setStatus(job.id, "claimed", "আবার চেষ্টা: ক্লাউড সার্ভার কাজটি নিয়েছে");
  const lag = job.createdAt ? ((Date.now() - Date.parse(job.createdAt)) / 1000).toFixed(1) : "?";
  try { dispatch(job.id); console.log(`${ts()} [${job.id}] picked up ${lag}s after queueing -> build.yml dispatched`); }
  catch (e) {
    const err = String(e.stderr || e.message).slice(0, 200);
    console.log(`${ts()} [${job.id}] dispatch failed: ${err}`);
    await setStatus(job.id, "failed", "বিল্ড শুরু করা গেল না, আবার চেষ্টা করুন");
  }
}

(async () => {
  const end = Date.now() + RUN_SECONDS * 1000;
  const seen = new Set();
  let cursor = null, polls = 0;
  console.log(`${ts()} worker up for ${RUN_SECONDS}s, polling every ${EVERY_MS / 1000}s`);
  while (Date.now() < end) {
    const t0 = Date.now();
    try {
      const jobs = await queued(cursor);
      cursor = newestCursor(jobs, cursor);
      for (const j of jobs) { if (seen.has(j.id)) continue; seen.add(j.id); await consider(j); }
    } catch (e) { console.log(`${ts()} poll error: ${String(e.message).slice(0, 200)}`); }
    if (++polls % 90 === 0) console.log(`${ts()} alive, ${polls} polls, ${seen.size} jobs seen`);
    await sleep(Math.max(1000, EVERY_MS - (Date.now() - t0)));
  }
  console.log(`${ts()} worker window over after ${polls} polls`);
})();
