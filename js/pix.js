/* =============================================================================
 * DOAÇÃO VIA PIX — modal com QR Code + "copiar chave"
 * -----------------------------------------------------------------------------
 * Botões com [data-abrir-pix] (tela inicial e tela final) abrem um modal que:
 *   - gera o QR Code do Pix "copia e cola" (via js/vendor/qrcode.min.js, MIT) —
 *     a pessoa escaneia com o app do banco;
 *   - oferece um botão para COPIAR a chave Pix (o código copia-e-cola completo).
 *
 * O QR é gerado SOB DEMANDA (só na 1ª abertura). Tudo é estático e local — não
 * depende de rede nem de CDN.
 *
 * Para trocar a chave no futuro: altere PIX_COPIA_COLA abaixo (código completo,
 * incluindo o CRC16 nos 4 últimos dígitos).
 * ===========================================================================*/
(function () {
  "use strict";

  // Pix "copia e cola" (payload EMV completo, com CRC16). Recebedor: Matheus.
  var PIX_COPIA_COLA =
    "00020126580014br.gov.bcb.pix01364c83415e-0b75-4a40-b0b6-83a0c12a71355204000053039865802BR5911MATHEUS19176009Sao Paulo610901227-20062230519daqr21591091736170363041A4B";

  var modal = document.getElementById("pix-modal");
  if (!modal) return;
  var qrBox = modal.querySelector("#pix-qr");
  var btnCopiar = modal.querySelector("#pix-copiar");
  var msgCopiado = modal.querySelector("#pix-copiado");
  var qrGerado = false;
  var ultimoFoco = null;

  function gerarQR() {
    if (qrGerado) return;
    if (typeof QRCode === "function") {
      try {
        new QRCode(qrBox, {
          text: PIX_COPIA_COLA,
          width: 220,
          height: 220,
          correctLevel: QRCode.CorrectLevel.M
        });
        qrGerado = true;
      } catch (e) {
        qrBox.innerHTML = '<p class="pix-qr-erro">Não foi possível gerar o QR Code. Use o botão "Copiar chave Pix" abaixo.</p>';
      }
    } else {
      qrBox.innerHTML = '<p class="pix-qr-erro">Use o botão "Copiar chave Pix" abaixo para doar.</p>';
    }
  }

  function copiarChave() {
    function sucesso() {
      if (msgCopiado) {
        msgCopiado.hidden = false;
        setTimeout(function () { msgCopiado.hidden = true; }, 4000);
      }
    }
    // API moderna; com fallback para execCommand em navegadores antigos.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(PIX_COPIA_COLA).then(sucesso, fallbackCopia);
    } else {
      fallbackCopia();
    }
    function fallbackCopia() {
      try {
        var ta = document.createElement("textarea");
        ta.value = PIX_COPIA_COLA;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        sucesso();
      } catch (e) {
        window.prompt("Copie a chave Pix:", PIX_COPIA_COLA);
      }
    }
  }

  function abrir() {
    ultimoFoco = document.activeElement;
    gerarQR();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var fechar = modal.querySelector(".feedback-fechar");
    if (fechar) fechar.focus();
  }
  function fechar() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (msgCopiado) msgCopiado.hidden = true;
    if (ultimoFoco && typeof ultimoFoco.focus === "function") ultimoFoco.focus();
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-abrir-pix]")) { e.preventDefault(); abrir(); }
    else if (e.target.closest("[data-fechar-pix]")) { e.preventDefault(); fechar(); }
  });
  if (btnCopiar) btnCopiar.addEventListener("click", copiarChave);
  // Esc fecha; Tab preso dentro do modal (focus-trap, a11y).
  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") { fechar(); return; }
    if (e.key === "Tab") {
      var foco = modal.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
      foco = Array.prototype.filter.call(foco, function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!foco.length) return;
      var primeiro = foco[0], ultimo = foco[foco.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  });
})();
