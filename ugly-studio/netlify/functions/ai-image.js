// ai-image.js  ::  GPT Image = Designer (renders posters, mockups, packaging)
// Zero npm dependencies. Env: OPENAI_API_KEY
// Returns { b64 } PNG. Front end uploads it to Supabase storage for the Library.
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

  // size: "1024x1024" (square/menu), "1024x1536" (poster/portrait), "1536x1024" (banner/landscape)
  const allowed = ["1024x1024", "1024x1536", "1536x1024", "auto"];
  const size = allowed.includes(body.size) ? body.size : "1024x1536";
  const quality = ["low", "medium", "high", "auto"].includes(body.quality) ? body.quality : "high";

  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size, quality, n: 1 }),
    });
    const data = await r.json();
    if (!r.ok) return { statusCode: r.status, headers: cors, body: JSON.stringify({ error: data.error?.message || "openai error", raw: data }) };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return { statusCode: 502, headers: cors, body: JSON.stringify({ error: "no image returned", raw: data }) };
    return { statusCode: 200, headers: cors, body: JSON.stringify({ b64, size }) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
