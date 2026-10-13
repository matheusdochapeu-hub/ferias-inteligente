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

  // Mês (0-11) a partir do qual o app pode "virar" para o próximo ano.
  // Regra do projeto: só exibir o ano seguinte a partir de 1º de OUTUBRO (mês 9),
  // depois que os calendários/decretos do ano subsequente já foram publicados e
  // conferidos. Antes disso, mantém o ano corrente.
  const MES_VIRADA = 9; // outubro

  function carregarJSON(caminho) {
    return fetch(caminho, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Falha ao carregar ${caminho} (HTTP ${r.status})`);
      return r.json();
    });
  }

  /* Decide qual ano o app deve exibir, dado:
   *   - a lista de anos publicados (data/feriados/index.json)
   *   - a data atual (hoje)
   * Regra (Decisão A): mostra o MAIOR ano publicado que já esteja "liberado".
   * Um ano Y só fica liberado a partir de 1º/out do ano Y-1. Ou seja:
   *   - antes de 1º/out/(Y-1): o app NÃO exibe Y ainda (mesmo que o JSON exista);
   *   - de 1º/out/(Y-1) em diante: Y passa a ser exibível.
   * Entre os exibíveis, escolhe o maior. Fallback: o maior ano publicado. */
  function escolherAno(anosPublicados, hoje) {
    const anoHoje = hoje.getFullYear();
    const mesHoje = hoje.getMonth();
    // "ano-alvo liberado": o próximo ano fica liberado a partir de 1º/out
    const anoLiberadoMax = mesHoje >= MES_VIRADA ? anoHoje + 1 : anoHoje;
    const liberados = anosPublicados.filter((a) => a <= anoLiberadoMax);
    const base = liberados.length ? liberados : anosPublicados;
    return Math.max.apply(null, base);
  }

  /* Remonta window.CALENDARIOS[ano] no mesmo formato do antigo feriados-ANO.js */
  function montarCalendarios(ano, entesDoc, nacionais, pmrp, usp, limeira) {
    const entes = entesDoc.entes;
    // regra de abonada padrão (fallback) caso um ente não traga o campo
    const abonadaPadrao = { maxPorMes: 1, tetoAno: 6, mesesDuplosNoAno: 0 };

    const calendario = {
      ano: nacionais.ano,
      quartaDeCinzas: nacionais.quartaDeCinzas,
      nacionais: nacionais.nacionais || [],
      nacionaisFacultativos: nacionais.nacionaisFacultativos || [],
      entes: {
        usp: {
          id: entes.usp.id,
          nome: entes.usp.nome,
          nomeCurto: entes.usp.nomeCurto,
          esfera: entes.usp.esfera,
          pagamento: entes.usp.pagamento,
          abonadas: entes.usp.abonadas || abonadaPadrao,
          estaduais: usp.estaduais || [],
          facultativosGerais: usp.facultativosGerais || [],
          cidades: usp.cidades || {},
          _observacao: usp._observacao
        },
        pmrp: {
          id: entes.pmrp.id,
          nome: entes.pmrp.nome,
          nomeCurto: entes.pmrp.nomeCurto,
          esfera: entes.pmrp.esfera,
          pagamento: entes.pmrp.pagamento,
          abonadas: entes.pmrp.abonadas || abonadaPadrao,
          feriadosLocais: pmrp.feriadosLocais || [],
          estaduais: pmrp.estaduais || [],
          facultativosLocais: pmrp.facultativosLocais || [],
          _observacao: pmrp._observacao
        },
        limeira: {
          id: entes.limeira.id,
          nome: entes.limeira.nome,
          nomeCurto: entes.limeira.nomeCurto,
          esfera: entes.limeira.esfera,
          pagamento: entes.limeira.pagamento,
          abonadas: entes.limeira.abonadas || abonadaPadrao,
          feriadosLocais: limeira.feriadosLocais || [],
          estaduais: limeira.estaduais || [],
          facultativosLocais: limeira.facultativosLocais || [],
          _observacao: limeira._observacao
        }
      }
    };

    window.CALENDARIOS = window.CALENDARIOS || {};
    window.CALENDARIOS[ano] = calendario;
    window.ANO_ATIVO = ano; // o motor e a UI leem este ano dinâmico
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

  /* Tenta carregar os JSON de um ano específico. Resolve com os dados ou rejeita
   * (ex.: 404 se os arquivos daquele ano ainda não existem). */
  function carregarAno(ano, entesDoc) {
    return Promise.all([
      carregarJSON(`data/feriados/nacionais-${ano}.json`),
      carregarJSON(`data/feriados/pmrp-${ano}.json`),
      carregarJSON(`data/feriados/usp-${ano}.json`),
      carregarJSON(`data/feriados/limeira-${ano}.json`)
    ]).then(([nacionais, pmrp, usp, limeira]) => ({ ano, entesDoc, nacionais, pmrp, usp, limeira }));
  }

  function iniciar() {
    // 1) lê o índice; 2) escolhe o ano a exibir pela regra; 3) tenta carregar os
    // JSON desse ano e, se faltar algum (índice e arquivos divergentes), cai para
    // o PRÓXIMO maior ano cujos arquivos existam — em vez de derrubar o app.
    carregarJSON("data/feriados/index.json")
      .then((indice) => {
        const anos = (indice && Array.isArray(indice.anos) && indice.anos.length)
          ? indice.anos.slice()
          : [new Date().getFullYear()];
        const alvo = escolherAno(anos, new Date());

        // ordem de tentativa: o ano escolhido primeiro, depois os demais do maior
        // para o menor (fallback resiliente).
        const candidatos = [alvo].concat(
          anos.slice().sort((a, b) => b - a).filter((a) => a !== alvo)
        );

        return carregarJSON("data/entes.json").then((entesDoc) => {
          // tenta cada candidato em sequência até um carregar por completo
          return candidatos.reduce(
            (promessa, ano) => promessa.catch(() => carregarAno(ano, entesDoc)),
            Promise.reject() // começa rejeitado para a 1ª tentativa rodar no catch
          );
        });
      })
      .then(({ ano, entesDoc, nacionais, pmrp, usp, limeira }) => {
        montarCalendarios(ano, entesDoc, nacionais, pmrp, usp, limeira);
        if (window.App && typeof window.App.iniciar === "function") {
          window.App.iniciar();
        }
      })
      .catch((err) => {
        console.error("[dados] erro ao carregar a base de feriados:", err);
        mostrarErro("Não foi possível carregar a base de feriados.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
