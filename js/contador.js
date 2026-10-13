/* =============================================================================
 * CONTADOR DE ACESSOS (visível apenas para o desenvolvedor)
 * -----------------------------------------------------------------------------
 * Como funciona:
 *   - A cada carregamento da página, registra UMA visita no serviço gratuito
 *     Abacus (https://abacus.jasoncameron.dev) — sem cadastro, sem chave.
 *       • /hit/{namespace}/{key} -> incrementa e devolve { value }
 *       • /get/{namespace}/{key} -> apenas lê (não incrementa)
 *   - O número NÃO aparece para o visitante comum. Ele só é exibido num
 *     painelzinho discreto quando o modo DEV é ativado por:
 *       (a) URL secreta:  ...?dev=67086719
 *       (b) Atalho:       digite a sequência "dev" e informe a senha no prompt
 *
 * ⚠️ AVISO DE SEGURANÇA (importante):
 *   Este é um site estático e público. A "senha" abaixo fica no JavaScript que
 *   qualquer pessoa pode ler no código-fonte do site. Portanto ela serve apenas
 *   para ESCONDER o painel do usuário comum — NÃO é segurança de verdade.
 *   Não reutilize esta senha para nada importante (e-mail, banco, etc.).
 *
 * Como contar visitas únicas (opcional):
 *   Por padrão conta TODO carregamento de página. Se quiser contar no máximo
 *   1 por navegador por dia, veja a flag CONTAR_UMA_VEZ_POR_DIA abaixo.
 * ===========================================================================*/
(function () {
  "use strict";

  // --------- Configuração ---------
  const CFG = {
    base: "https://abacus.jasoncameron.dev",
    namespace: "ferias-inteligente-mrr", // identificador do app no serviço
    key: "acessos",                      // nome do contador
    senhaDev: "67086719",                // chave para revelar o painel (só ofuscação!)
    paramDev: "dev",                     // ?dev=<senha> ativa o modo dev
    sequenciaAtalho: "dev",              // digitar isso (fora de inputs) pede a senha
    CONTAR_UMA_VEZ_POR_DIA: false        // true = no máx. 1 visita/navegador/dia
  };

  // --------- Utilidades ---------
  function url(acao) {
    return `${CFG.base}/${acao}/${encodeURIComponent(CFG.namespace)}/${encodeURIComponent(CFG.key)}`;
  }

  // Decide se esta visita deve incrementar (hit) ou apenas ler (get).
  function deveContar() {
    if (!CFG.CONTAR_UMA_VEZ_POR_DIA) return true;
    try {
      const hoje = new Date().toISOString().slice(0, 10); // AAAA-MM-DD
      const marca = localStorage.getItem("fi_ultimo_hit");
      if (marca === hoje) return false;
      localStorage.setItem("fi_ultimo_hit", hoje);
      return true;
    } catch (_) {
      return true; // se localStorage indisponível, conta normalmente
    }
  }

  // Registra a visita (ou só lê) e devolve o total via Promise<number|null>.
  function registrarVisita() {
    const acao = deveContar() ? "hit" : "get";
    return fetch(url(acao), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && typeof d.value === "number" ? d.value : null))
      .catch(() => null);
  }

  // Lê o total sem incrementar (usado ao abrir o painel de dev).
  function lerTotal() {
    return fetch(url("get"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && typeof d.value === "number" ? d.value : null))
      .catch(() => null);
  }

  // --------- Painel de dev ---------
  let totalMemoria = null; // guarda o último total conhecido nesta sessão

  function modoDevAtivo() {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get(CFG.paramDev) === CFG.senhaDev;
    } catch (_) {
      return false;
    }
  }

  function mostrarPainel(total) {
    let painel = document.getElementById("dev-contador");
    if (!painel) {
      painel = document.createElement("div");
      painel.id = "dev-contador";
      painel.setAttribute("role", "status");
      document.body.appendChild(painel);
    }
    const n = (total === null || total === undefined) ? "—" : total.toLocaleString("pt-BR");
    painel.innerHTML =
      `<span class="dev-contador-rotulo">👁️ acessos (dev)</span>` +
      `<strong class="dev-contador-num">${n}</strong>` +
      `<button type="button" class="dev-contador-fechar" aria-label="Fechar">✕</button>`;
    painel.style.display = "flex";
    painel.querySelector(".dev-contador-fechar").addEventListener("click", () => {
      painel.style.display = "none";
    });
  }

  // Abre o painel: usa o total em memória se já tiver; senão lê do serviço.
  function abrirPainel() {
    if (totalMemoria !== null) {
      mostrarPainel(totalMemoria);
    } else {
      lerTotal().then((t) => {
        totalMemoria = t;
        mostrarPainel(t);
      });
    }
  }

  // --------- Atalho de teclado (digitar a sequência -> pedir senha) ---------
  function instalarAtalho() {
    let buffer = "";
    document.addEventListener("keydown", (e) => {
      // ignora quando o foco está num campo de texto
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
      if (e.key && e.key.length === 1) {
        buffer = (buffer + e.key.toLowerCase()).slice(-CFG.sequenciaAtalho.length);
        if (buffer === CFG.sequenciaAtalho) {
          buffer = "";
          const tentativa = window.prompt("Senha de desenvolvedor:");
          if (tentativa === CFG.senhaDev) abrirPainel();
          else if (tentativa !== null) window.alert("Senha incorreta.");
        }
      }
    });
  }

  // --------- Inicialização ---------
  function iniciar() {
    // 1) sempre registra a visita (silenciosamente), guardando o total
    registrarVisita().then((t) => {
      totalMemoria = t;
      // 2) se o modo dev já veio pela URL, mostra o painel na hora
      if (modoDevAtivo()) abrirPainel();
    });
    // 3) instala o atalho de teclado para revelar sob demanda
    instalarAtalho();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
