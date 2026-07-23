// brandbook-process-background.js
// Netlify BACKGROUND function (name ends with -background): runs up to 15 minutes,
// so we can read the ENTIRE brand book with the accurate model (claude-opus-4-8)
// without the 10s sync timeout. The app polls the brandbook_jobs row for progress + result.
// Env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
const MODEL = "claude-opus-4-8";

function stripJSON(t){
  const m = t.match(/```(?:json)?([\s\S]*?)```/);
  let s = (m ? m[1] : t).trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch { return null; }
}
// best-effort repair of a truncated JSON object: close a dangling string and
// close open braces/brackets in the correct reverse order (stack based).
function repairJSON(t){
  const a = t.indexOf("{"); if (a < 0) return null;
  let s = t.slice(a).replace(/[\s,]+$/, "");
  const stack = []; let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  let fix = s;
  if (inStr) fix += '"';
  fix = fix.replace(/[\s,]+$/, "");
  for (let i = stack.length - 1; i >= 0; i--) fix += stack[i] === "{" ? "}" : "]";
  try { return JSON.parse(fix); } catch { return null; }
}

async function sbREST(path, opts = {}) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(opts.headers || {}) },
  });
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
async function setJob(id, fields) {
  fields.updated_at = new Date().toISOString();
  await sbREST(`brandbook_jobs?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fields) });
}
async function anthropic(system, content, max_tokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens, system, messages: [{ role: "user", content }] }),
  });
  const raw = await r.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
  if (!r.ok || !data) throw new Error((data && data.error && data.error.message) || `anthropic error (${r.status})` + (raw ? `: ${raw.slice(0, 120)}` : ""));
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}
async function urlToImageBlock(url) {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: ct.includes("png") ? "image/png" : "image/jpeg", data: buf.toString("base64") } };
}
async function removeStoragePaths(urls) {
  const key = process.env.SUPABASE_SERVICE_KEY, base = process.env.SUPABASE_URL;
  for (const u of urls) {
    const m = /\/object\/public\/library\/(.+)$/.exec(u || "");
    if (!m) continue;
    try { await fetch(`${base}/storage/v1/object/library/${m[1]}`, { method: "DELETE", headers: { apikey: key, authorization: `Bearer ${key}` } }); } catch {}
  }
}

const EXTRACT_SYS = "You are extracting a brand's complete guidelines from its official brand book. " +
  "From the given material capture EVERYTHING brand-relevant in exhaustive detail and never summarize away specifics: " +
  "mission and why, positioning, all taglines, the full color system (every color with its exact HEX and CMYK/RGB/Pantone if shown, plus each color's role and usage), " +
  "the typography system (every typeface, weights, sizes, tracking, usage), logo usage (variations, minimum size, clear space, placement, and every misuse rule), " +
  "imagery and photography style, iconography and graphic elements, tone of voice with real example phrases, all do and do-not rules, layout and spacing, and any applications. " +
  "Output detailed plain-text notes under clear headings. Keep exact values verbatim. Never use em dashes.";

// Synthesis is split into small, independent calls so no single JSON can be truncated.
const SECTIONS = [
  { key: "core", tokens: 2000,
    spec: '{"name": string, "philosophy": {"tagline": string, "mission": string, "feeling": string, "why": string, "founder_words": string, "heritage": string, "cultural_gesture": string, "story_order": string, "positioning": string, "positioning_rule": string, "pillars": [{"name": string, "desc": string}]}}',
    ask: "Capture the brand mission, the one feeling it sells, the founder memory and words, heritage story, cultural gestures, the rule for what order the story is told in, positioning and any positioning rule, and the brand pillars." },
  { key: "color_type", tokens: 2200,
    spec: '{"colors": [{"name": string, "hex": string, "pantone": string, "role": string, "never": string}], "color_rule": string, "typography": {"display": string, "body": string, "note": string, "script_note": string, "fonts": [{"name": string, "role": string, "weights": string, "rule": string}]}}',
    ask: "Capture EVERY color with its exact hex, any Pantone, what it is used for and what it must never be used for, plus any rule governing the colors. Then every typeface with its role, weights and key rule." },
  { key: "voice", tokens: 2200,
    spec: '{"voice": {"tone": string, "traits": [{"name": string, "desc": string}], "sound_like": [string], "never_sound_like": [string], "contexts": [{"context": string, "tone": string, "example": string}], "dos": [string], "donts": [string]}}',
    ask: "Capture the voice: tone, named traits with descriptions, the lists of what the brand sounds like and never sounds like, and the per-context tone table with its real examples." },
  { key: "lines", tokens: 2000,
    spec: '{"taglines": [{"line": string, "kind": string, "use": string}], "tagline_rule": string, "naming": [{"pattern": string, "rule": string, "examples": string}]}',
    ask: "Capture every official tagline and brand saying with its kind and where it is used, any rule about improvising lines, and all naming conventions with examples." },
  { key: "visual", tokens: 2600,
    spec: '{"logo": {"marks": [{"name": string, "use": string}], "clear_space": string, "never": [string]}, "illustration": {"style": string, "items": [{"name": string, "use": string, "never": string}]}}',
    ask: "Capture every logo mark and where it is used, the clear space rule, and every logo misuse rule. Then the illustration style and each illustration with where it is used and where it must never be used." },
  { key: "photo_store", tokens: 2400,
    spec: '{"photography": {"principles": [{"name": string, "desc": string}], "brief": string, "spec": {"product": string, "lighting": string, "surfaces": string, "composition": string, "typography": string, "feel": string}, "note": string}, "signage": {"elements": [{"name": string, "desc": string}], "consistency": string}}',
    ask: "Capture the photography principles, the shorthand brief, the full photography specification, any note separating set colors from brand colors, and every in-store or signage element plus the consistency rule." },
];

const sectionSys = (spec, ask) =>
  "You are building one section of a brand's DNA from detailed notes taken across its entire brand book. " +
  ask + " Return ONLY a JSON object with exactly this shape and nothing else: " + spec + ". " +
  "Use only what the notes support, leave a field as an empty string or empty array if the book does not cover it. " +
  "Keep exact values (hex codes, font names, quoted lines) verbatim. Keep each string concise so the JSON stays complete and valid. Never use em dashes.";

const GUIDE_SYS = "You write a brand's full guidelines reference from detailed notes taken across its entire brand book. " +
  "Return plain text only (no JSON, no code fences). Organize under clear headings and cover everything not already structured: any tables, measurements, file formats, applications, and any detail a designer would need. " +
  "Keep exact values verbatim. Be thorough. Never use em dashes.";

exports.handler = async (event) => {
  let jobId;
  try { jobId = JSON.parse(event.body || "{}").jobId; } catch {}
  if (!jobId) return { statusCode: 400, body: "no jobId" };
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    await setJob(jobId, { status: "error", error: "Server env not set (ANTHROPIC_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)" }).catch(()=>{});
    return { statusCode: 500, body: "env" };
  }

  try {
    const rows = await sbREST(`brandbook_jobs?id=eq.${jobId}&select=*`);
    const job = rows && rows[0];
    if (!job) return { statusCode: 404, body: "job not found" };
    await setJob(jobId, { status: "running", progress: "Starting to read the brand book...", error: null });

    const notes = [];
    const pages = Array.isArray(job.pages) ? job.pages : [];
    if (pages.length) {
      const BATCH = 3;
      for (let i = 0; i < pages.length; i += BATCH) {
        const slice = pages.slice(i, i + BATCH);
        await setJob(jobId, { progress: `Reading pages ${i + 1} to ${Math.min(i + BATCH, pages.length)} of ${pages.length}...` });
        const imgs = [];
        for (const u of slice) imgs.push(await urlToImageBlock(u));
        const textRef = (job.book_text || "").slice(i * 1200, (i + BATCH) * 1200);
        const note = await anthropic(EXTRACT_SYS, [...imgs, { type: "text", text: `Brand book pages ${i + 1} to ${Math.min(i + BATCH, pages.length)}. Text layer for reference:\n${textRef}\n\nExtract every brand detail from these pages.` }], 3000);
        notes.push(note);
      }
    } else if (job.book_text) {
      const t = job.book_text, CH = 16000;
      for (let s = 0, p = 1; s < t.length; s += CH, p++) {
        await setJob(jobId, { progress: `Reading the brand book (part ${p})...` });
        const note = await anthropic(EXTRACT_SYS, `Brand book text (part ${p}):\n${t.slice(s, s + CH)}\n\nExtract every brand detail from this part.`, 3000);
        notes.push(note);
      }
    } else {
      throw new Error("The job has no pages or text to read.");
    }

    const notesText = notes.join("\n\n----\n\n").slice(0, 90000);
    const dna = {};
    for (let i = 0; i < SECTIONS.length; i++) {
      const sec = SECTIONS[i];
      await setJob(jobId, { progress: `Organizing the brand DNA (${i + 1} of ${SECTIONS.length + 1})...` });
      try {
        const out = await anthropic(sectionSys(sec.spec, sec.ask), `Notes from the full brand book:\n\n${notesText}\n\nReturn this section as JSON now.`, sec.tokens);
        const j = stripJSON(out) || repairJSON(out);
        if (j) Object.assign(dna, j);
      } catch (e) { /* one weak section must not lose the rest */ }
    }

    await setJob(jobId, { progress: `Writing the full brand guidelines (${SECTIONS.length + 1} of ${SECTIONS.length + 1})...` });
    try {
      const guide = await anthropic(GUIDE_SYS, `Notes from the full brand book:\n\n${notesText}\n\nWrite the full guidelines reference now.`, 4000);
      if (guide) dna.guidelines = guide;
    } catch { /* keep the structured DNA even if this pass fails */ }

    // best-effort cleanup of the temporary page images
    if (pages.length) removeStoragePaths(pages).catch(()=>{});

    const gotSomething = dna.philosophy || (dna.colors && dna.colors.length) || dna.voice || dna.guidelines;
    if (gotSomething) await setJob(jobId, { status: "done", progress: "Done.", result: dna });
    else await setJob(jobId, { status: "error", error: "Could not assemble the brand DNA from this book." });
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    await setJob(jobId, { status: "error", error: String(e && e.message || e) }).catch(()=>{});
    return { statusCode: 200, body: "handled" };
  }
};
