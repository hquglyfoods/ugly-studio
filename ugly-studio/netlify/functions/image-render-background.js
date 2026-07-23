// image-render-background.js
// Netlify BACKGROUND function (name ends with -background): runs up to 15 minutes.
// Image models routinely take far longer than a normal request is allowed to,
// so rendering happens here and the app polls studio_jobs for the result.
// Env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

const RETRY_STATUS = [429, 500, 502, 503, 504, 529];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// One shared retry policy: transient overload should never surface as a failure.
async function withRetry(fn, { tries = 4, base = 1500, label = "request" } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fn();
      if (r && r.status && RETRY_STATUS.includes(r.status) && i < tries - 1) {
        await sleep(base * Math.pow(2, i));
        continue;
      }
      return r;
    } catch (e) {
      last = e;
      if (i === tries - 1) break;
      await sleep(base * Math.pow(2, i));
    }
  }
  throw last || new Error(`${label} failed`);
}

async function sbREST(path, opts = {}) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const r = await withRetry(() => fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(opts.headers || {}) },
  }), { label: "supabase" });
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function setJob(id, fields) {
  fields.updated_at = new Date().toISOString();
  await sbREST(`studio_jobs?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fields) });
}

async function openai(payload) {
  return await withRetry(() => fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(payload),
  }), { tries: 3, base: 2000, label: "openai" });
}

async function uploadPng(brand, buf) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  const path = `${brand}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const r = await withRetry(() => fetch(`${url}/storage/v1/object/creations/${path}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "image/png" },
    body: buf,
  }), { label: "storage" });
  if (!r.ok) throw new Error(`Could not store the image (${r.status})`);
  return `${url}/storage/v1/object/public/creations/${path}`;
}

exports.handler = async (event) => {
  let jobId;
  try { jobId = JSON.parse(event.body || "{}").jobId; } catch {}
  if (!jobId) return { statusCode: 400, body: "no jobId" };
  if (!process.env.OPENAI_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    await setJob(jobId, { status: "error", error: "Server env not set (OPENAI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY)" }).catch(() => {});
    return { statusCode: 500, body: "env" };
  }

  try {
    const rows = await sbREST(`studio_jobs?id=eq.${jobId}&select=*`);
    const job = rows && rows[0];
    if (!job) return { statusCode: 404, body: "job not found" };
    await setJob(jobId, { status: "running", progress: "Rendering...", error: null });

    const allowed = ["1024x1024", "1024x1536", "1536x1024"];
    const size = allowed.includes(job.size) ? job.size : "1024x1536";

    // preferred model first, then a fallback that needs no organization verification
    let b64 = null, used = "";
    let r = await openai({ model: "gpt-image-1", prompt: job.prompt, size, quality: "high", n: 1 });
    let data = await r.json().catch(() => ({}));
    if (r.ok && data.data && data.data[0] && data.data[0].b64_json) { b64 = data.data[0].b64_json; used = "gpt-image-1"; }
    else {
      await setJob(jobId, { progress: "Rendering (fallback model)..." });
      const dalleSize = size === "1024x1536" ? "1024x1792" : size === "1536x1024" ? "1792x1024" : "1024x1024";
      const r2 = await openai({ model: "dall-e-3", prompt: job.prompt, size: dalleSize, quality: "hd", response_format: "b64_json", n: 1 });
      const d2 = await r2.json().catch(() => ({}));
      if (r2.ok && d2.data && d2.data[0] && d2.data[0].b64_json) { b64 = d2.data[0].b64_json; used = "dall-e-3"; }
      else {
        const msg = (data.error && data.error.message) || (d2.error && d2.error.message) || "image generation failed";
        throw new Error(msg);
      }
    }

    await setJob(jobId, { progress: "Saving the image..." });
    const url = await uploadPng(job.brand || "ugly", Buffer.from(b64, "base64"));
    await setJob(jobId, { status: "done", progress: "Done.", result: { url, model: used, size } });
    return { statusCode: 200, body: "ok" };
  } catch (e) {
    await setJob(jobId, { status: "error", error: String((e && e.message) || e) }).catch(() => {});
    return { statusCode: 200, body: "handled" };
  }
};
