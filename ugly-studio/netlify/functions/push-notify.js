// push-notify.js  ::  send a web push to every subscribed HQ device.
// Front end "Send test" calls this; future triggers can call it too.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (optional)
const { sendPush } = require("./lib/push");

async function sbREST(path, opts = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...(opts.headers || {}) },
  });
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

exports.handler = async (event) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };

  const vapid = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT || "mailto:hq@uglydonutsncorndogs.com",
  };
  if (!process.env.SUPABASE_URL || !vapid.privateKey) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "push env not set (SUPABASE_URL / VAPID_PRIVATE_KEY)" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  const payload = JSON.stringify({
    title: body.title || "Ugly Studio",
    body: body.body || "Notifications are on.",
    url: body.url || "/",
    tag: body.tag || "ugly-studio",
    badge: typeof body.badge === "number" ? body.badge : 0,
  });

  const subs = (await sbREST("push_subscriptions?select=id,endpoint,p256dh,auth")) || [];
  let sent = 0, gone = 0;
  for (const s of subs) {
    try {
      const res = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid);
      if (res.ok) sent++;
      else if (res.gone) { gone++; await sbREST(`push_subscriptions?id=eq.${s.id}`, { method: "DELETE" }); }
    } catch (e) { /* skip one bad sub */ }
  }
  return { statusCode: 200, headers: cors, body: JSON.stringify({ sent, gone, total: subs.length }) };
};
