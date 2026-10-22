// Кэш для игры: после первого захода с интернетом она открывается и без него (установи игру на главный экран)
const CACHE = "ascii-v1";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "worlds/vkusno-i-tochka-3-etazha.baseAscii"];
const LIBS = ["https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js", "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js", "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap";

self.addEventListener("install", e => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.allSettled([...CORE.map(u => cache.add(u)), ...LIBS.map(u => cache.add(u))]);
  // Шрифт: сначала страница стилей, потом файлы, которые она называет
  try {
    const css = await (await fetch(FONT_CSS)).text();
    await cache.put(FONT_CSS, new Response(css, { headers: { "Content-Type": "text/css" } }));
    await Promise.allSettled([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => cache.add(m[1])));
  } catch {}
  await self.skipWaiting();
})()));

self.addEventListener("activate", e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || !url.protocol.startsWith("http")) return;
  if (/firebaseio\.com|identitytoolkit|securetoken/.test(url.hostname)) return;  // сетевая игра — только напрямую
  const same = url.origin === location.origin;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (same) {  // свои файлы: сначала сеть (всегда свежая версия), нет сети — из кэша
      try { const r = await fetch(req); if (r.ok) cache.put(req, r.clone()); return r; }
      catch { return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("index.html")) || Response.error(); }
    }
    const hit = await cache.match(req);  // библиотеки и шрифты: из кэша, обновляем фоном
    const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })());
});
