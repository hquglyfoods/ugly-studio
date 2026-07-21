// lib/push.js  ::  zero-dependency Web Push (aes128gcm, RFC 8188 / 8291 + VAPID ES256)
// Node 18 crypto only. VAPID keys must never change once devices are subscribed.
const crypto = require("crypto");

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// HKDF via Node (does Extract + Expand): HKDF(salt, ikm, info, len)
function hkdf(ikm, salt, info, len) {
  return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len));
}

// Build the aes128gcm-encrypted body for one subscription.
function encrypt(uaPublic, uaAuth, payload) {
  const ecdh = crypto.createECDH("prime256v1");
  const asPublic = ecdh.generateKeys();            // 65 bytes, uncompressed
  const shared = ecdh.computeSecret(uaPublic);     // ECDH secret
  const salt = crypto.randomBytes(16);

  // RFC 8291: derive IKM from the auth secret
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(shared, uaAuth, keyInfo, 32);

  // RFC 8188 aes128gcm content encryption keys
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);

  // single record: plaintext = payload || 0x02 delimiter
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  // header: salt(16) | rs(4) | idlen(1) | keyid(as_public,65)
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  const header = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic]);
  return Buffer.concat([header, enc]);
}

// VAPID Authorization header for an endpoint origin
function vapidHeader(endpoint, publicKey, privateKeyPem, subject) {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject || "mailto:hq@uglydonutsncorndogs.com" }));
  const signingInput = `${header}.${body}`;
  const sig = crypto.sign("sha256", Buffer.from(signingInput), { key: privateKeyPem, dsaEncoding: "ieee-p1363" });
  const jwt = `${signingInput}.${b64u(sig)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

// Send one push. Returns { ok, status, endpoint }. 404/410 => caller should delete the subscription.
async function sendPush(subscription, payloadString, vapid, ttl = 2419200) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const uaAuth = unb64u(subscription.keys.auth);
  const body = encrypt(uaPublic, uaAuth, payloadString);
  const auth = vapidHeader(subscription.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject);
  const r = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": String(ttl),
      "Authorization": auth,
    },
    body,
  });
  return { ok: r.ok, status: r.status, endpoint: subscription.endpoint, gone: r.status === 404 || r.status === 410 };
}

module.exports = { sendPush, vapidHeader, encrypt, b64u, unb64u };
