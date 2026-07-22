// Ugly Studio service worker.
// index.html and navigations are NETWORK-FIRST so every deploy is picked up on reload.
// Only versioned/stable assets (icons, pinned CDN libs) are cache-first.
const CACHE = 'ugly-studio-v3';
const SHELL = [
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/appicon.png', '/icons/logo.png',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.26.4/babel.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App HTML / navigations: NETWORK-FIRST (always get the latest deploy; fall back to cache offline)
  const isDoc = req.mode === 'navigate' ||
    (url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html'));
  if (isDoc) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: 'no-store' });
        const c = await caches.open(CACHE); c.put('/index.html', net.clone());
        return net;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Versioned / stable assets: cache-first
  const isIcon = url.origin === self.location.origin && url.pathname.startsWith('/icons/');
  const isLib = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
  if (!isIcon && !isLib) return;
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const net = fetch(req).then((res) => { if (res && res.status === 200) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => cached);
    return cached || net;
  })());
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'Ugly Studio', body: event.data && event.data.text() }; }
  const title = d.title || 'Ugly Studio';
  const opts = { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/badge.png', tag: d.tag || 'ugly-studio', data: { url: d.url || '/' } };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    if (typeof d.badge === 'number' && self.registration.setAppBadge) { try { d.badge > 0 ? self.registration.setAppBadge(d.badge) : self.registration.clearAppBadge(); } catch (e) {} }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { c.navigate(target); return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
