// ai-image.js  ::  GPT Image = Designer (renders posters, mockups, packaging)
// Zero npm dependencies. Env: OPENAI_API_KEY
// Tries gpt-image-1 first. If the org is not verified for it (or it errors),
// automatically falls back to dall-e-3 so images still generate.
// Returns { b64, model }.
async function callOpenAI(key, payload) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "POST only" }) };

  const key = process.env.OPENAI_API_KEY;
  if (!key) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "OPENAI_API_KEY not set in Netlify env" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "bad json" }) }; }

  const prompt = String(body.prompt || "").trim();
  if (!prompt) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "prompt required" }) };

  const allowed = ["1024x1024", "1024x1536", "1536x1024", "auto"];
  const size = allowed.includes(body.size) ? body.size : "1024x1536";
  const quality = ["low", "medium", "high", "auto"].includes(body.quality) ? body.quality : "high";

  // 1) primary: gpt-image-1
  try {
    const first = await callOpenAI(key, { model: "gpt-image-1", prompt, size, quality, n: 1 });
    if (first.ok && first.data.data && first.data.data[0] && first.data.data[0].b64_json) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ b64: first.data.data[0].b64_json, size, model: "gpt-image-1" }) };
    }
    // 2) fallback: dall-e-3 (no org verification required)
    const dalleSize = size === "1024x1536" ? "1024x1792" : size === "1536x1024" ? "1792x1024" : "1024x1024";
    const second = await callOpenAI(key, { model: "dall-e-3", prompt, size: dalleSize, quality: "hd", response_format: "b64_json", n: 1 });
    if (second.ok && second.data.data && second.data.data[0] && second.data.data[0].b64_json) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ b64: second.data.data[0].b64_json, size: dalleSize, model: "dall-e-3" }) };
    }
    const msg = (first.data.error && first.data.error.message) || (second.data.error && second.data.error.message) || "image generation failed";
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: msg, hint: "If this mentions verification, verify your OpenAI organization, or dall-e-3 fallback should work with billing enabled." }) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
