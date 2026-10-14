/* =============================================================================
 * "FALE COM O DESENVOLVEDOR" — modal com formulário do Google embutido
 * -----------------------------------------------------------------------------
 * Botões com [data-abrir-feedback] (tela inicial e tela final) abrem um modal
 * que embute o Google Forms num <iframe>. O iframe só é criado na 1ª abertura
 * (carregamento sob demanda — não pesa no load inicial do app).
 *
 * Robustez: se o iframe não carregar (política de incorporação, rede, etc.),
 * o modal mostra um link de fallback "abrir em nova aba" (já presente no HTML).
 *
 * Para trocar o formulário no futuro: altere FORM_URL abaixo (e o href de
 * fallback no index.html). Aceita tanto o link curto forms.gle quanto a URL
 * longa docs.google.com/.../viewform.
 * ===========================================================================*/
(function () {
  "use strict";

  var FORM_URL = "https://forms.gle/DEXgWCQFVf4JjqoL6";

  var modal = document.getElementById("feedback-modal");
  if (!modal) return;
  var corpo = modal.querySelector("#feedback-corpo");
  var iframeCarregado = false;
  var ultimoFoco = null;

  // Monta a URL de incorporação. O Google aceita ?embedded=true na viewform;
  // no link curto, o próprio redirecionamento leva à viewform embutida.
  function urlEmbed() {
    if (/\/viewform/.test(FORM_URL)) {
      return FORM_URL + (FORM_URL.indexOf("?") >= 0 ? "&" : "?") + "embedded=true";
    }
    // link curto (forms.gle): acrescenta o parâmetro; o redirect preserva.
    return FORM_URL + (FORM_URL.indexOf("?") >= 0 ? "&" : "?") + "embedded=true";
  }

  function criarIframe() {
    if (iframeCarregado) return;
    var ifr = document.createElement("iframe");
    ifr.src = urlEmbed();
    ifr.title = "Formulário: Fale com o desenvolvedor";
    ifr.loading = "lazy";
    ifr.setAttribute("frameborder", "0");
    ifr.className = "feedback-iframe";
    corpo.appendChild(ifr);
    iframeCarregado = true;
  }

  function abrir() {
    ultimoFoco = document.activeElement;
    criarIframe();
    modal.hidden = false;
    document.body.style.overflow = "hidden"; // trava o scroll do fundo
    var fechar = modal.querySelector(".feedback-fechar");
    if (fechar) fechar.focus();
  }

  function fechar() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (ultimoFoco && typeof ultimoFoco.focus === "function") ultimoFoco.focus();
  }

  // Delegação de eventos: abre/fecha conforme os data-atributos.
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-abrir-feedback]")) { e.preventDefault(); abrir(); }
    else if (e.target.closest("[data-fechar-feedback]")) { e.preventDefault(); fechar(); }
  });

  // Esc fecha o modal.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) fechar();
  });
})();
