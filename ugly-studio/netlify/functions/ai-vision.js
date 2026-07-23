// ai-vision.js  ::  Claude Vision = studies uploaded posters / materials
// Extracts brand-relevant notes so past work becomes searchable, reusable context.
// Zero npm dependencies. Env: ANTHROPIC_API_KEY
const MODEL = "claude-opus-4-8";

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "POST only" }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set in Netlify env" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "bad json" }) }; }

  const media_type = String(body.media_type || "image/png");
  const b64 = String(body.b64 || "");
  const system = String(body.system || "");
  const ask = String(body.ask || "Analyze this piece of Ugly Donuts brand material.");
  if (!b64) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "b64 image required" }) };

  const messages = [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type, data: b64 } },
      { type: "text", text: ask },
    ],
  }];

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: (typeof body.model === "string" && body.model) || MODEL, max_tokens: 1500, system, messages }),
    });
    const data = await r.json();
    if (!r.ok) return { statusCode: r.status, headers: cors, body: JSON.stringify({ error: data.error?.message || "anthropic error", raw: data }) };
    const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text).join("\n").trim();
    return { statusCode: 200, headers: cors, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
