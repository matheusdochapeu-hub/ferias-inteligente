/* ============================================================================
 * PWA — REGISTRO DO SERVICE WORKER & INSTALAÇÃO DO APP
 * -----------------------------------------------------------------------------
 * 1. Registra o service worker (sw.js) para habilitar instalação e uso offline.
 * 2. Gerencia o botão "Instalar aplicativo" e o evento nativo 'beforeinstallprompt'.
 * 3. Se o app já estiver instalado (modo standalone, appinstalled ou gravado em
 *    localStorage), o botão desaparece imediatamente.
 * 4. No iOS/Safari ou navegadores sem prompt nativo, abre o modal ilustrado.
 * ===========================================================================*/
(function () {
  "use strict";

  const STORAGE_KEY = "ferias_app_instalado";
  let deferredInstallPrompt = null;

  function $(sel) {
    return document.querySelector(sel);
  }

  function $$(sel) {
    return document.querySelectorAll(sel);
  }

  function ehStandalone() {
    if (typeof window === "undefined") return false;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return true;
    } catch (_) {}

    return (
      (window.matchMedia && (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches
      )) ||
      window.navigator.standalone === true ||
      (typeof document !== "undefined" && document.referrer && document.referrer.includes("android-app://"))
    );
  }

  function ocultarBotaoInstalar() {
    const btn = $("#btn-instalar-app");
    if (btn) btn.style.display = "none";
    const actions = $(".header-actions");
    if (actions) actions.style.display = "none";
  }

  function abrirModalInstalar() {
    const modal = $("#instalar-modal");
    if (modal) {
      modal.hidden = false;
      const fecharBtn = modal.querySelector(".feedback-fechar");
      if (fecharBtn) fecharBtn.focus();
    }
  }

  function fecharModalInstalar() {
    const modal = $("#instalar-modal");
    if (modal) {
      modal.hidden = true;
      const btn = $("#btn-instalar-app");
      if (btn && btn.offsetParent !== null) btn.focus();
    }
  }

  function marcarComoInstalado() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (_) {}
    ocultarBotaoInstalar();
    fecharModalInstalar();
  }

  function inicializarInstalacao() {
    if (typeof document === "undefined") return;
    const btnInstall = $("#btn-instalar-app");

    // Se já estiver rodando instalado como PWA ou já marcado como instalado, desaparece imediatamente
    if (ehStandalone()) {
      ocultarBotaoInstalar();
      return;
    }

    // Monitora mudança dinâmica para modo standalone (ex.: durante a navegação)
    if (window.matchMedia) {
      const mq = window.matchMedia("(display-mode: standalone)");
      const handler = function (e) {
        if (e.matches) marcarComoInstalado();
      };
      if (mq.addEventListener) {
        mq.addEventListener("change", handler);
      } else if (mq.addListener) {
        mq.addListener(handler);
      }
    }

    // Captura o evento nativo do Android / Chrome / Edge
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (!ehStandalone() && btnInstall) {
        btnInstall.style.display = "inline-flex";
        const actions = $(".header-actions");
        if (actions) actions.style.display = "flex";
      }
    });

    if (btnInstall) {
      btnInstall.addEventListener("click", async function () {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === "accepted") {
            marcarComoInstalado();
          }
          deferredInstallPrompt = null;
        } else {
          // iOS Safari, Firefox ou navegadores desktop que não dispararam prompt nativo
          abrirModalInstalar();
        }
      });
    }

    // Botão no modal para quem já adicionou à tela de início no iOS
    const btnJaInstalei = $("[data-ja-instalado]");
    if (btnJaInstalei) {
      btnJaInstalei.addEventListener("click", marcarComoInstalado);
    }

    // Fecha o modal ao clicar no backdrop ou botões com data-fechar-instalar
    $$("[data-fechar-instalar]").forEach(function (el) {
      el.addEventListener("click", fecharModalInstalar);
    });

    // Fecha com tecla ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        const modal = $("#instalar-modal");
        if (modal && !modal.hidden) fecharModalInstalar();
      }
    });

    // Evento disparado quando o app é concluído com sucesso no SO
    window.addEventListener("appinstalled", function () {
      marcarComoInstalado();
    });
  }

  // Registra Service Worker
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof location !== "undefined") {
    if (location.protocol === "http:" || location.protocol === "https:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function (err) {
          console.warn("[pwa] não foi possível registrar o service worker:", err);
        });
      });
    }
  }

  // Inicializa botões e modais de instalação após carregamento do DOM
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", inicializarInstalacao);
    } else {
      inicializarInstalacao();
    }
  }

  // Export para testes
  if (typeof module === "object" && module.exports) {
    module.exports = {
      ehStandalone,
      ocultarBotaoInstalar,
      marcarComoInstalado,
      abrirModalInstalar,
      fecharModalInstalar,
      inicializarInstalacao,
      STORAGE_KEY
    };
  }
})();
