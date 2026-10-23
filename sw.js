// Кэш для игры: после первого захода с интернетом она открывается и без него (установи игру на главный экран)
const CACHE = "ascii-v3";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "worlds/vkusno-i-tochka-3-etazha.baseAscii",
  "lib/qrcode.js", "lib/jsQR.js", "meme.jpg"];
const LIBS = ["https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js", "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js", "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"];
const CACHED_HOSTS = ["cdn.jsdelivr.net", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const FONT_CSS = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap";
const NET_WAIT = 4000;  // столько ждём сеть для своих файлов: на плохом мобильном интернете игра не висит, а берёт кэш

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
  const same = url.origin === location.origin;
  // Кэшируем только свои файлы и известные библиотеки. Всё остальное (в первую очередь сервер игры, Firebase) идёт напрямую, мимо кэша
  if (!same && !CACHED_HOSTS.includes(url.hostname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (same) {  // свои файлы: сначала сеть (всегда свежая версия), нет сети или она молчит дольше NET_WAIT — из кэша
      const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
      net.catch(() => {});  // сеть отказала позже, чем ответил кэш, — это не ошибка
      try {
        return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error("долго")), NET_WAIT))]);
      } catch {
        // index.html вместо страницы — только для самой страницы: мир или картинка не должны превращаться в HTML
        const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : null);
        return hit || net.catch(() => Response.error());  // в кэше пусто — ждём сеть до конца
      }
    }
    const hit = await cache.match(req);  // библиотеки и шрифты: из кэша, обновляем фоном
    const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
    if (hit) { net.catch(() => {}); return hit; }
    return net.catch(() => Response.error());
  })());
});
