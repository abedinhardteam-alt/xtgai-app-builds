// Static checks for a generated single-file HTML app + one AI repair attempt (free keyless Pollinations).
const MAX_HTML = 250 * 1024;

function stripFences(t) {
  t = String(t || "").trim();
  const m = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (m && /<html|<!doctype/i.test(m[1])) t = m[1].trim();
  const s = t.search(/<!doctype html|<html/i);
  if (s > 0) t = t.slice(s);
  const e = t.toLowerCase().lastIndexOf("</html>");
  if (e > 0) t = t.slice(0, e + 7);
  return t;
}

function scripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: m[1], code: m[2] }));
}

/** Returns a list of problems (empty = OK). */
function check(html) {
  const p = [];
  if (!html || !/<html[\s>]/i.test(html)) p.push("missing <html> element");
  if (!/<\/html>\s*$/i.test(html || "")) p.push("file is cut off (no closing </html>)");
  if (!/<body[\s>]/i.test(html || "")) p.push("missing <body>");
  if (Buffer.byteLength(html || "", "utf8") > MAX_HTML) p.push("too large (max 250 KB)");
  const sc = scripts(html || "");
  for (const s of sc) {
    if (/\bsrc\s*=/.test(s.attrs)) p.push("external <script src> is not allowed (app runs offline)");
    if (/type\s*=\s*["']?module/i.test(s.attrs)) continue;
    try { new Function(s.code); } catch (e) { p.push("JavaScript syntax error: " + e.message); }
  }
  if (/<link[^>]+href\s*=\s*["']https?:/i.test(html || "")) p.push("external stylesheet/font link (app runs offline)");
  return p;
}

/** Add viewport meta if missing (phone layout). */
function normalize(html) {
  if (!/name\s*=\s*["']viewport/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`);
  }
  if (!/<meta[^>]+charset/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n<meta charset="utf-8">`);
  return html;
}

async function aiRepair(html, problems) {
  const body = {
    model: "openai-fast", reasoning_effort: "low",
    messages: [
      { role: "system", content: "You fix single-file offline HTML/JS/CSS apps. Return ONLY the complete corrected HTML file from <!DOCTYPE html> to </html>. Keep all features and texts; no external URLs." },
      { role: "user", content: "Problems found:\n- " + problems.join("\n- ") + "\n\nHTML:\n" + html },
    ],
  };
  const r = await fetch("https://text.pollinations.ai/openai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(240000) });
  if (!r.ok) throw new Error("AI repair HTTP " + r.status);
  const j = await r.json();
  return stripFences(j.choices?.[0]?.message?.content || "");
}

module.exports = { check, normalize, stripFences, aiRepair, MAX_HTML };
