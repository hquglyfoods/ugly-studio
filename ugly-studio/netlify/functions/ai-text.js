// ai-text.js  ::  Claude = Brand Director (concept, copy, art direction, critique)
// Zero npm dependencies. Uses native fetch (Node 18+ on Netlify).
// Env: ANTHROPIC_API_KEY
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

  const system = String(body.system || "");
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const max_tokens = Math.min(Number(body.max_tokens) || 2000, 4000);
  const model = body.model || MODEL;
  if (!messages.length) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "messages required" }) };

  try {
    const send = (useModel) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: useModel, max_tokens, system, messages }),
    });
    let r = await send(model);
    let data = await r.json();
    // if a requested non-default model is unavailable, fall back to the default once
    if (!r.ok && model !== MODEL && /model/i.test((data.error && data.error.message) || "")) {
      r = await send(MODEL); data = await r.json();
    }
    if (!r.ok) return { statusCode: r.status, headers: cors, body: JSON.stringify({ error: data.error?.message || "anthropic error", raw: data }) };
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return { statusCode: 200, headers: cors, body: JSON.stringify({ text, model: data.model || model, usage: data.usage || null }) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
