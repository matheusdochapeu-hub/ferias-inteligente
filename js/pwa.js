/* ============================================================================
 * REGISTRO DO PWA (service worker)
 * -----------------------------------------------------------------------------
 * Registra o service worker (sw.js) para habilitar instalação e uso offline.
 * Usa caminho RELATIVO para funcionar em GitHub Pages num subdiretório.
 *
 * Só registra quando servido por http(s). Abrindo o index.html via file://
 * (sem servidor) o service worker não é suportado — então apenas ignoramos,
 * sem poluir o console com erro.
 * ===========================================================================*/
(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "http:" && location.protocol !== "https:") return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function (err) {
      console.warn("[pwa] não foi possível registrar o service worker:", err);
    });
  });
})();
