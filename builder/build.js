// Turns one job {id,name,desc,color,icon,html} into a signed APK using ../template (native Java WebView shell).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const icons = require("./icons");
const lint = require("./lint");

const ROOT = path.resolve(__dirname, "..");

function xmlText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/@/g, "\\@").replace(/\?/g, "\\?").replace(/\n/g, " ");
}
function cleanName(n) {
  n = String(n || "").replace(/[\u0000-\u001f<>{}\[\]\\`*#]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!n) throw new Error("অ্যাপের নাম নেই");
  return n;
}
function cleanColor(c) { return /^#[0-9A-Fa-f]{6}$/.test(String(c || "")) ? String(c).toUpperCase() : "#1565C0"; }
function darker(hex, f = 0.62) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("").toUpperCase();
}
/** Same name → same package, so a rebuilt app installs as an update of the earlier one. */
function packageFor(name) {
  const latin = name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^[0-9]+/, "").slice(0, 24);
  const h = crypto.createHash("sha1").update(name.normalize("NFC").toLowerCase()).digest("hex").slice(0, 8);
  return "com.ishaq.xtgapps." + (latin ? latin + "_" : "app_") + h;
}
function versionFor(now = Date.now()) {
  const vc = Math.floor((now - Date.UTC(2026, 0, 1)) / 60000);   // minutes since 2026 → always increasing
  const d = new Date(now);
  const vn = `1.${d.getUTCFullYear() % 100}${String(d.getUTCMonth() + 1).padStart(2, "0")}.${vc % 100000}`;
  return { vc, vn };
}
function cp(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === "build" || e.name === ".gradle") continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? cp(s, d) : fs.copyFileSync(s, d);
  }
}
function sub(file, map) {
  let t = fs.readFileSync(file, "utf8");
  for (const [k, v] of Object.entries(map)) t = t.split(k).join(v);
  fs.writeFileSync(file, t);
}
function buildTools() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const bt = path.join(sdk, "build-tools");
  const v = fs.readdirSync(bt).filter((d) => /^\d/.test(d)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
  return path.join(bt, v);
}

/** Validate + (once) AI-repair the HTML. Returns final html. */
async function prepareHtml(html, status) {
  html = lint.normalize(lint.stripFences(html));
  let p = lint.check(html);
  if (p.length) {
    await status("repairing", "কোডে সমস্যা পাওয়া গেছে, AI দিয়ে ঠিক করা হচ্ছে: " + p.slice(0, 2).join("; "));
    try { html = lint.normalize(await lint.aiRepair(html, p)); } catch (e) { throw new Error("কোড ঠিক করা গেল না: " + p.join("; ")); }
    p = lint.check(html);
    if (p.length) throw new Error("কোডে এখনো সমস্যা: " + p.join("; "));
  }
  return html;
}

/** status(stage, msg) */
async function buildJob(job, work, status) {
  const name = cleanName(job.name);
  const color = cleanColor(job.color);
  const icon = icons.KEYS.includes(job.icon) ? job.icon : "bolt";
  const pkg = packageFor(name);
  const { vc, vn } = versionFor();
  await status("checking", "কোড যাচাই হচ্ছে (HTML/JS lint)");
  const html = await prepareHtml(job.html, status);

  await status("preparing", "অ্যান্ড্রয়েড প্রজেক্ট তৈরি হচ্ছে");
  fs.rmSync(work, { recursive: true, force: true });
  cp(path.join(ROOT, "template"), work);
  const res = path.join(work, "app/src/main/res");
  sub(path.join(work, "app/build.gradle.kts"), { __PKG__: pkg, __VC__: String(vc), __VN__: vn });
  sub(path.join(res, "values/strings.xml"), { __APP_NAME__: xmlText(name), __APP_DESC__: xmlText(String(job.desc || name).slice(0, 200)) });
  sub(path.join(res, "values/colors.xml"), { __COLOR__: color, __COLOR_DARK__: darker(color) });
  fs.writeFileSync(path.join(res, "drawable/ic_fg.xml"), icons.vector(icon));
  fs.writeFileSync(path.join(work, "app/src/main/assets/index.html"), html, "utf8");

  await status("building", "Gradle দিয়ে APK বানানো হচ্ছে");
  execFileSync("gradle", ["assembleRelease", "--no-daemon", "-q", "--stacktrace", ...(process.env.GRADLE_EXTRA ? process.env.GRADLE_EXTRA.split(" ") : [])], { cwd: work, stdio: "inherit", timeout: 20 * 60000 });

  await status("signing", "APK সাইন ও যাচাই হচ্ছে");
  const unsigned = path.join(work, "app/build/outputs/apk/release/app-release-unsigned.apk");
  const bt = buildTools();
  const aligned = path.join(work, "aligned.apk");
  const ascii = pkg.split(".").pop().replace(/_[0-9a-f]{8}$/, "") || "app";
  const out = path.join(work, `${ascii}-v${vn}.apk`);
  execFileSync(path.join(bt, "zipalign"), ["-f", "-p", "4", unsigned, aligned]);
  const ks = path.join(work, "xtgapps.jks");
  fs.writeFileSync(ks, Buffer.from(fs.readFileSync(path.join(ROOT, "keystore/xtgapps.jks.b64"), "utf8").replace(/\s+/g, ""), "base64"));
  execFileSync(path.join(bt, "apksigner"), ["sign", "--ks", ks, "--ks-key-alias", "xtgapps", "--ks-pass", "pass:xtgapps-public", "--key-pass", "pass:xtgapps-public", "--out", out, aligned]);
  const verify = execFileSync(path.join(bt, "apksigner"), ["verify", "--print-certs", out]).toString();
  const badging = execFileSync(path.join(bt, "aapt2"), ["dump", "badging", out]).toString();
  if (!badging.includes(`package: name='${pkg}'`)) throw new Error("package check failed");
  return { apk: out, pkg, vc, vn, name, sha256: crypto.createHash("sha256").update(fs.readFileSync(out)).digest("hex"), verify, badging: badging.split("\n").slice(0, 3).join("\n"), html };
}

module.exports = { buildJob, packageFor, versionFor, cleanName, darker, xmlText };
