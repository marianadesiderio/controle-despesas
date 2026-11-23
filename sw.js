/* Controle de Despesas: service worker. Com internet busca a versão nova; sem internet usa a última guardada. */
var CACHE = 'despesas-3703740b';
var ARQS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'xlsx.full.min.js', 'pdf.min.js', 'pdf.worker.min.js'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ARQS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function guarda(req, resp) { if (resp && resp.ok) { var cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); } return resp; }
self.addEventListener('fetch', function (e) {
  var req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin) return; /* sincronização com o Google passa direto */
  var pagina = req.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname) || /\.(webmanifest)$/.test(u.pathname);
  if (pagina) {
    /* página: rede primeiro (até 4 s), depois a cópia guardada */
    e.respondWith(new Promise(function (ok) {
      var feito = false;
      var t = setTimeout(function () { caches.match('index.html').then(function (r) { if (r && !feito) { feito = true; ok(r); } }); }, 4000);
      fetch(u.href, { cache: 'no-cache', credentials: 'same-origin' }).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status); /* site fora do ar ou republicando: usa a cópia guardada */
        clearTimeout(t); guarda(req.mode === 'navigate' ? 'index.html' : req, resp.clone());
        if (!feito) { feito = true; ok(resp); }
      }).catch(function () {
        clearTimeout(t);
        caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }).then(function (r) { if (!feito) { feito = true; ok(r); } });
      });
    }));
    return;
  }
  /* bibliotecas e ícones: cópia guardada primeiro */
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || fetch(req).then(function (resp) { return guarda(req, resp); });
  }));
});
