/* =============================================================================
 * CARREGADOR DE DADOS (feriados em JSON)
 * -----------------------------------------------------------------------------
 * A partir da refatoração para JSON, os feriados NÃO ficam mais embutidos num
 * .js global. Eles vivem em arquivos de dados puros:
 *
 *   data/entes.json                      -> metadados dos entes (sem datas)
 *   data/feriados/nacionais-{ano}.json   -> nacionais + facultativos nacionais
 *   data/feriados/pmrp-{ano}.json        -> feriados da PMRP
 *   data/feriados/usp-{ano}.json         -> feriados da USP (com cidades)
 *
 * Este módulo busca esses arquivos com fetch(), remonta EXATAMENTE a mesma
 * estrutura que o resto do app já espera em window.CALENDARIOS[ano] e só então
 * inicia o App. Assim motor.js e app.js continuam funcionando sem alteração.
 *
 * IMPORTANTE: fetch() de arquivos locais NÃO funciona abrindo o index.html por
 * file:// (bloqueio de CORS do navegador). Rode via GitHub Pages ou um servidor
 * local, por exemplo:  python3 -m http.server  (e acesse http://localhost:8000)
 * ===========================================================================*/
(function () {
  "use strict";

  const ANO = 2027; // ano atual suportado pelo app

  function carregarJSON(caminho) {
    return fetch(caminho, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Falha ao carregar ${caminho} (HTTP ${r.status})`);
      return r.json();
    });
  }

  /* Remonta window.CALENDARIOS[ANO] no mesmo formato do antigo feriados-ANO.js */
  function montarCalendarios(entesDoc, nacionais, pmrp, usp) {
    const entes = entesDoc.entes;

    const calendario = {
      ano: nacionais.ano,
      quartaDeCinzas: nacionais.quartaDeCinzas,
      nacionais: nacionais.nacionais || [],
      nacionaisFacultativos: nacionais.nacionaisFacultativos || [],
      entes: {
        pmrp: {
          id: entes.pmrp.id,
          nome: entes.pmrp.nome,
          nomeCurto: entes.pmrp.nomeCurto,
          esfera: entes.pmrp.esfera,
          pagamento: entes.pmrp.pagamento,
          feriadosLocais: pmrp.feriadosLocais || [],
          estaduais: pmrp.estaduais || [],
          facultativosLocais: pmrp.facultativosLocais || [],
          _observacao: pmrp._observacao
        },
        usp: {
          id: entes.usp.id,
          nome: entes.usp.nome,
          nomeCurto: entes.usp.nomeCurto,
          esfera: entes.usp.esfera,
          pagamento: entes.usp.pagamento,
          estaduais: usp.estaduais || [],
          facultativosGerais: usp.facultativosGerais || [],
          cidades: usp.cidades || {},
          _observacao: usp._observacao
        }
      }
    };

    window.CALENDARIOS = window.CALENDARIOS || {};
    window.CALENDARIOS[ANO] = calendario;
  }

  function mostrarErro(msg) {
    const orgao = document.getElementById("tela-orgao");
    const aviso = document.createElement("div");
    aviso.className = "info-box info-box-amarelo";
    aviso.innerHTML =
      "⚠️ " + msg + "<br><small>Se você abriu o arquivo direto do computador " +
      "(file://), use o site publicado ou rode um servidor local " +
      "(ex.: <code>python3 -m http.server</code>).</small>";
    if (orgao) orgao.insertBefore(aviso, orgao.firstChild);
    else document.body.appendChild(aviso);
  }

  function iniciar() {
    Promise.all([
      carregarJSON("data/entes.json"),
      carregarJSON(`data/feriados/nacionais-${ANO}.json`),
      carregarJSON(`data/feriados/pmrp-${ANO}.json`),
      carregarJSON(`data/feriados/usp-${ANO}.json`)
    ])
      .then(([entesDoc, nacionais, pmrp, usp]) => {
        montarCalendarios(entesDoc, nacionais, pmrp, usp);
        if (window.App && typeof window.App.iniciar === "function") {
          window.App.iniciar();
        }
      })
      .catch((err) => {
        console.error("[dados] erro ao carregar a base de feriados:", err);
        mostrarErro("Não foi possível carregar a base de feriados de " + ANO + ".");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
