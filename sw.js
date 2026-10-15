/* ============================================================================
 * SERVICE WORKER — Férias Inteligente (PWA)
 * -----------------------------------------------------------------------------
 * Torna o app instalável e utilizável OFFLINE. Estratégias:
 *
 *   • App shell (HTML/CSS/JS/ícones/manifest): CACHE-FIRST com precache no
 *     install. Carrega instantâneo e funciona sem rede.
 *
 *   • Dados de feriados (data/**.json): STALE-WHILE-REVALIDATE. Responde do
 *     cache na hora (offline ok) e, em paralelo, busca a versão nova na rede e
 *     atualiza o cache para o próximo acesso. Isso respeita a ATUALIZAÇÃO ANUAL
 *     dos feriados sem travar o usuário offline.
 *
 *   • Navegações (document): tenta a rede primeiro e cai para o index.html do
 *     cache quando offline (comportamento de "app" numa SPA de telas).
 *
 * Todos os caminhos são RELATIVOS ao escopo do SW, então funciona tanto em
 * GitHub Pages num subdiretório (/ferias-inteligente/) quanto na raiz.
 *
 * Ao publicar mudanças nos assets, incremente CACHE_VERSION para invalidar o
 * cache antigo (o SW novo faz a limpeza no 'activate').
 * ===========================================================================*/
"use strict";

const CACHE_VERSION = "v1";
const CACHE_SHELL = `ferias-shell-${CACHE_VERSION}`;
const CACHE_DADOS = `ferias-dados-${CACHE_VERSION}`;

// Resolve URLs relativas ao local do próprio sw.js (robusto a subdiretórios).
const base = new URL("./", self.registration ? self.registration.scope : self.location.href);
const u = (p) => new URL(p, base).toString();

// App shell: tudo que o app precisa para abrir e rodar offline.
const PRECACHE = [
  "./",
  "index.html",
  "css/estilo.css",
  "js/motor.js",
  "js/app.js",
  "js/dados.js",
  "js/contador.js",
  "js/feedback.js",
  "js/pix.js",
  "js/vendor/qrcode.min.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
].map(u);

// -- INSTALL: pré-carrega o app shell ----------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      // addAll falha tudo se um item falhar; usamos tolerância item-a-item para
      // não quebrar o install caso um asset opcional esteja ausente.
      Promise.allSettled(
        PRECACHE.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((r) => (r.ok ? cache.put(url, r.clone()) : null))
            .catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// -- ACTIVATE: remove caches de versões anteriores ---------------------------
self.addEventListener("activate", (event) => {
  const manter = new Set([CACHE_SHELL, CACHE_DADOS]);
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((k) => k.startsWith("ferias-") && !manter.has(k))
              .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// -- helpers de estratégia ----------------------------------------------------
function staleWhileRevalidate(request) {
  return caches.open(CACHE_DADOS).then((cache) =>
    cache.match(request).then((cacheado) => {
      const rede = fetch(request)
        .then((resp) => {
          if (resp && resp.ok) cache.put(request, resp.clone());
          return resp;
        })
        .catch(() => null);
      // responde do cache já; se não tiver, espera a rede
      return cacheado || rede.then((r) => r || Response.error());
    })
  );
}

function cacheFirst(request) {
  return caches.match(request).then((cacheado) => {
    if (cacheado) return cacheado;
    return fetch(request).then((resp) => {
      if (resp && resp.ok && resp.type === "basic") {
        const copia = resp.clone();
        caches.open(CACHE_SHELL).then((c) => c.put(request, copia));
      }
      return resp;
    });
  });
}

function networkFirstDoc(request) {
  return fetch(request)
    .then((resp) => {
      if (resp && resp.ok) {
        const copia = resp.clone();
        caches.open(CACHE_SHELL).then((c) => c.put(request, copia));
      }
      return resp;
    })
    .catch(() => caches.match(request).then((r) => r || caches.match(u("index.html"))));
}

// -- FETCH: roteia por tipo de recurso ---------------------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Só gerencia requisições de mesma origem (ignora iframe do Google Forms etc.)
  if (url.origin !== self.location.origin) return;

  // Navegações de página -> network-first com fallback ao index offline.
  if (req.mode === "navigate") {
    event.respondWith(networkFirstDoc(req));
    return;
  }

  // Dados de feriados -> stale-while-revalidate (atualiza em background).
  if (url.pathname.includes("/data/") && url.pathname.endsWith(".json")) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Demais assets do shell -> cache-first.
  event.respondWith(cacheFirst(req));
});
