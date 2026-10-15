/* =============================================================================
 * CONTROLE DE INTERFACE (navegação entre telas e renderização)
 * -----------------------------------------------------------------------------
 * Fluxo:
 *   órgão -> (cidade, se USP) -> dias -> resultados -> [escolher período]
 *     -> se sobram dias: pergunta "continuar com N dias restantes?" ou finalizar
 *     -> página final (resumo do plano + calendários + PDF)
 * ===========================================================================*/
const App = (function () {
  const H = Motor.helpers;

  const estado = {
    ente: null,       // "pmrp" | "usp"
    cidade: null,     // apenas USP
    dias: null,       // dias da ETAPA atual (10|15|20|30 ou o que sobrou)
    modo: "corridas", // modo de cálculo atual
    plano: [],        // períodos já escolhidos: [{ sugestao, modo, dias }]
    etapa: 1,         // 1 = primeira seleção, 2 = segunda (dias restantes)
    mesesPreferidos: [], // meses (0-11) p/ filtrar o INÍCIO das férias; vazio = todos
    usaEspeciais: false, // usuário indicou que tem banco de horas / folgas TRE?
    diasEspeciais: 0    // saldo informado de dias especiais a usar
  };

  const TOTAL_FERIAS = 30; // direito total de dias no ano

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  function mostrarTela(id) {
    document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
    $("#" + id).classList.add("ativa");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Inicialização / listeners ---------- */
  function iniciar() {
    // Guarda: se a base de feriados não carregou (ex.: 404 do arquivo de dados),
    // avisa de forma clara em vez de estourar um TypeError no 1º clique.
    if (!window.CALENDARIOS || !window.CALENDARIOS[window.ANO_ATIVO]) {
      const orgao = $("#tela-orgao");
      if (orgao) {
        const aviso = el("div", "info-box info-box-amarelo",
          "⚠️ Não foi possível carregar a base de feriados. " +
          "Recarregue a página; se persistir, verifique sua conexão.");
        orgao.insertBefore(aviso, orgao.firstChild);
      }
      return; // não registra os listeners que dependem dos dados
    }

    // Preenche o ano exibido (dinâmico) nos textos da interface.
    const ano = window.ANO_ATIVO;
    const subt = $("#ano-subtitulo"); if (subt) subt.textContent = " · " + ano;
    const plano = $("#ano-plano"); if (plano) plano.textContent = ano;
    const titulo = document.querySelector("title");
    if (titulo) titulo.textContent = `Férias Inteligente — Servidores Públicos (${ano})`;

    $("#btn-usp").addEventListener("click", () => {
      estado.ente = "usp";
      estado.cidade = null;
      renderCidades();
      mostrarTela("tela-cidade");
    });
    $("#btn-pmrp").addEventListener("click", () => {
      estado.ente = "pmrp";
      estado.cidade = "Ribeirão Preto";
      mostrarTela("tela-dias");
      renderInfoEnte();
    });
    $("#btn-limeira").addEventListener("click", () => {
      estado.ente = "limeira";
      estado.cidade = null; // Limeira (município) não tem seleção de cidade
      mostrarTela("tela-dias");
      renderInfoEnte();
    });

    document.querySelectorAll("[data-voltar]").forEach((b) =>
      b.addEventListener("click", () => {
        let alvo = b.getAttribute("data-voltar");
        if (alvo === "tela-orgao") resetar();
        // Na 2ª etapa (2º período), "mudar nº de dias" não pode cair direto em
        // tela-dias: lá o fluxo recomeçaria errado (sem reoferecer o 2º período
        // e pulando a preferência de mês). Volta à decisão, que reconstrói as
        // opções de dias restantes a partir do 1º período já escolhido.
        if (alvo === "tela-dias" && estado.etapa === 2) {
          const ehUsp = estado.ente === "usp";
          const opcoes = opcoesRestantes(estado.plano[0].dias, ehUsp);
          renderDecisao(opcoes);
          alvo = "tela-decisao";
        }
        mostrarTela(alvo);
      })
    );

    document.querySelectorAll(".btn-dias").forEach((b) =>
      b.addEventListener("click", () => {
        estado.dias = Number(b.getAttribute("data-dias"));
        // na 1ª etapa pergunta preferência de mês; na 2ª (dias restantes) vai direto
        if (estado.etapa === 1) {
          estado.mesesPreferidos = [];
          renderPreferenciaMes();
          mostrarTela("tela-mes");
        } else {
          renderResultados();
          mostrarTela("tela-resultados");
        }
      })
    );

    document.querySelectorAll(".aba[data-modo]").forEach((b) =>
      b.addEventListener("click", () => {
        estado.modo = b.getAttribute("data-modo");
        renderResultados();
      })
    );

    // ---- Banco de horas / folgas TRE (passo opcional na tela de dias) ----
    // As funções de sincronização visual (marcarEspOpt/atualizaValorEsp) estão
    // no escopo do módulo para que renderInfoEnte() possa restaurar o bloco toda
    // vez que a tela-dias é montada (p/ qualquer ente). Aqui só registramos os
    // listeners dos botões.
    const espNao = $("#especiais-nao"), espSim = $("#especiais-sim");
    if (espNao) espNao.addEventListener("click", () => {
      estado.usaEspeciais = false;
      estado.diasEspeciais = 0;
      marcarEspOpt(false);
      atualizaValorEsp();
    });
    if (espSim) espSim.addEventListener("click", () => {
      estado.usaEspeciais = true;
      if (estado.diasEspeciais < 1) estado.diasEspeciais = 1; // começa em 1 ao ativar
      marcarEspOpt(true);
      atualizaValorEsp();
    });
    const espMenos = $("#especiais-menos"), espMais = $("#especiais-mais");
    if (espMenos) espMenos.addEventListener("click", () => {
      estado.diasEspeciais = Math.max(0, estado.diasEspeciais - 1);
      estado.usaEspeciais = estado.diasEspeciais > 0;
      if (!estado.usaEspeciais) marcarEspOpt(false);
      atualizaValorEsp();
    });
    if (espMais) espMais.addEventListener("click", () => {
      estado.diasEspeciais = Math.min(60, estado.diasEspeciais + 1); // teto de segurança da UI
      estado.usaEspeciais = true;
      marcarEspOpt(true); // garante que o painel esteja aberto ao aumentar
      atualizaValorEsp();
    });

    // imprimir / salvar o plano em PDF (usa a caixa de impressão do navegador)
    const pdf = $("#btn-pdf");
    if (pdf) pdf.addEventListener("click", () => window.print());

    // preferência de mês
    $("#mes-nao").addEventListener("click", () => avancarComMeses([]));          // sem preferência
    $("#mes-todos").addEventListener("click", () => avancarComMeses([]));        // todos os meses
    $("#mes-sim").addEventListener("click", () => {                              // tem preferência
      $("#mes-selecao").style.display = "";
      $("#mes-selecao").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    $("#mes-aplicar").addEventListener("click", () => {
      const sel = [...document.querySelectorAll(".btn-mes.sel")].map((b) => Number(b.getAttribute("data-mes")));
      avancarComMeses(sel); // se nada selecionado, [] = todos
    });
  }

  function resetar() {
    estado.ente = null;
    estado.cidade = null;
    estado.dias = null;
    estado.modo = "corridas";
    estado.plano = [];
    estado.etapa = 1;
    estado.mesesPreferidos = [];
    estado.usaEspeciais = false;
    estado.diasEspeciais = 0;
  }

  /* ---------- Tela cidade (USP) ---------- */
  function renderCidades() {
    const wrap = $("#grid-cidades");
    wrap.innerHTML = "";
    const cidades = Object.keys(window.CALENDARIOS[window.ANO_ATIVO].entes.usp.cidades).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
    cidades.forEach((c) => {
      const b = el("button", "btn-opcao btn-cidade", c);
      b.addEventListener("click", () => {
        estado.cidade = c;
        mostrarTela("tela-dias");
        renderInfoEnte();
      });
      wrap.appendChild(b);
    });
  }

  /* ---- Sincronização visual do bloco "dias especiais" (banco de horas/TRE) ----
   * Estas funções estão no escopo do MÓDULO (não dentro de iniciar) para que
   * renderInfoEnte() possa restaurar o bloco toda vez que a tela-dias é montada,
   * para QUALQUER ente (USP, PMRP, Limeira). Antes, o visual só mudava ao clicar,
   * então ao trocar de ente o bloco ficava dessincronizado com o estado. */
  function marcarEspOpt(ativo) {
    const espSim = $("#especiais-sim"), espNao = $("#especiais-nao"), espPainel = $("#especiais-painel");
    if (espSim) espSim.classList.toggle("sel", ativo);
    if (espNao) espNao.classList.toggle("sel", !ativo);
    if (espPainel) espPainel.style.display = ativo ? "" : "none";
  }
  function atualizaValorEsp() {
    const espValor = $("#especiais-valor");
    if (espValor) espValor.textContent = String(estado.diasEspeciais);
    // o botão "0 dias (só folgas)" só faz sentido com saldo >= 1
    const btnSo = document.querySelector(".btn-dias-especial");
    if (btnSo) btnSo.style.display = estado.diasEspeciais > 0 ? "" : "none";
  }
  /* Restaura o bloco de especiais ao estado lógico atual (usado ao entrar na
   * tela-dias). Mantém a escolha do usuário se ele já ativou nesta sessão. */
  function sincronizarEspeciais() {
    marcarEspOpt(!!estado.usaEspeciais);
    atualizaValorEsp();
  }

  function renderInfoEnte() {
    const ente = window.CALENDARIOS[window.ANO_ATIVO].entes[estado.ente];
    let txt = ente.nome;
    if (estado.ente === "usp" && estado.cidade) txt += " — " + estado.cidade;
    $("#info-ente").textContent = txt;

    // Opção de 5 dias e aviso de venda: exclusivos da USP
    const ehUsp = estado.ente === "usp";
    document.querySelectorAll("[data-usp-only]").forEach((b) => {
      b.style.display = ehUsp ? "" : "none";
    });
    const avisoVenda = $("#aviso-venda");
    if (avisoVenda) avisoVenda.style.display = ehUsp ? "" : "none";

    // Sincroniza o bloco de banco de horas / folgas TRE com o estado atual —
    // vale para TODOS os entes (corrige o caso de USP/Limeira ficarem com o
    // bloco dessincronizado após navegação entre entes).
    sincronizarEspeciais();
  }

  /* Quais nº de dias podem ser escolhidos no 2º período, dado o 1º.
   * Regras definidas pelo usuário:
   *   5  -> oferece [15]        (vendeu 10; 5+15 = 20)
   *   15 -> oferece [15, 5]     (15+15 = 30 cheios  OU  15+5 = 20 vendendo 10)
   *   10 -> oferece [20]
   *   20 -> oferece [10]
   *   30 -> (nada; finaliza)
   * Observação: 5 só é válido para USP. */
  function opcoesRestantes(diasEscolhidos, ehUsp) {
    const mapa = {
      5:  ehUsp ? [15] : [],
      10: [20],
      15: ehUsp ? [15, 5] : [15],
      20: [10],
      30: []
    };
    return mapa[diasEscolhidos] || [];
  }

  /* ---------- Tela: preferência de mês ---------- */
  function renderPreferenciaMes() {
    const ente = window.CALENDARIOS[window.ANO_ATIVO].entes[estado.ente];
    let txt = ente.nome;
    if (estado.ente === "usp" && estado.cidade) txt += " — " + estado.cidade;
    const etapaTxt = estado.etapa === 2 ? ` · 2º período (${estado.dias} dias restantes)` : ` · ${estado.dias} dias`;
    $("#mes-info").textContent = `${txt}${etapaTxt}`;

    // botão "voltar": na 1ª etapa volta aos dias; na 2ª volta à decisão
    const voltar = $("#mes-voltar");
    if (estado.etapa === 2) {
      voltar.setAttribute("data-voltar", "tela-decisao");
      voltar.textContent = "⬅️ Voltar";
    } else {
      voltar.setAttribute("data-voltar", "tela-dias");
      voltar.textContent = "⬅️ Mudar número de dias";
    }

    // garante que a grade de meses exista (gerada uma vez)
    const grade = $("#grid-meses");
    if (!grade.dataset.pronto) {
      grade.innerHTML = "";
      for (let m = 0; m < 12; m++) {
        const b = el("button", "btn-opcao btn-mes", nomeMesExtenso(m));
        b.setAttribute("data-mes", String(m));
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => {
          b.classList.toggle("sel");
          const sel = b.classList.contains("sel");
          b.setAttribute("aria-pressed", sel ? "true" : "false");
        });
        grade.appendChild(b);
      }
      grade.dataset.pronto = "1";
    } else {
      // limpa seleção anterior
      grade.querySelectorAll(".btn-mes").forEach((b) => {
        b.classList.remove("sel");
        b.setAttribute("aria-pressed", "false");
      });
    }
    // a parte de seleção de meses começa escondida (só aparece se "Sim")
    $("#mes-selecao").style.display = "none";
  }

  function avancarComMeses(meses) {
    estado.mesesPreferidos = meses;
    renderResultados();
    mostrarTela("tela-resultados");
  }

  /* ---------- Restrições do plano (para o 2º período) ---------- */
  function restricoesDoPlano() {
    const diasBloqueados = new Set();
    const mesesAbonadaUsados = new Set();
    const doacoesUsadas = [];
    let especiaisUsados = 0;
    estado.plano.forEach(({ sugestao }) => {
      // bloqueia o bloco inteiro (regra B)
      for (let d = new Date(sugestao.blocoInicio); d <= sugestao.blocoFim; d = H.addDias(d, 1)) {
        diasBloqueados.add(H.iso(d));
      }
      (sugestao.abonadas || []).forEach((a) => mesesAbonadaUsados.add(H.iso(a.dt).slice(0, 7)));
      (sugestao.doacoes || []).forEach((dc) => doacoesUsadas.push(new Date(dc.dt)));
      especiaisUsados += (sugestao.diasEspeciais || []).length;
    });
    // saldo de dias especiais restante para o 2º período (nunca negativo)
    const saldoEspeciais = estado.usaEspeciais
      ? Math.max(0, estado.diasEspeciais - especiaisUsados)
      : 0;
    // fracionado = true: estamos montando o 2º período. Sinaliza explicitamente
    // ao motor para desligar a cota de "mês duplo" (regra de Limeira).
    return {
      diasBloqueados, mesesAbonadaUsados, doacoesUsadas, fracionado: true,
      diasEspeciaisDisponiveis: saldoEspeciais
    };
  }

  /* ---------- Tela resultados ---------- */
  function renderResultados() {
    const ente = window.CALENDARIOS[window.ANO_ATIVO].entes[estado.ente];
    const etapaTxt = estado.etapa === 2
      ? ` &nbsp;·&nbsp; <em>2º período — ${estado.dias} dias restantes</em>`
      : "";
    const mesesTxt = (estado.mesesPreferidos && estado.mesesPreferidos.length)
      ? ` &nbsp;·&nbsp; 📌 ${estado.mesesPreferidos.slice().sort((a, b) => a - b).map(nomeMesExtenso).join(", ")}`
      : "";
    $("#res-cabecalho").innerHTML =
      `<strong>${ente.nome}</strong>` +
      (estado.ente === "usp" && estado.cidade ? ` — ${estado.cidade}` : "") +
      ` &nbsp;·&nbsp; ${estado.dias} dias de férias &nbsp;·&nbsp; ano ${window.ANO_ATIVO}` + etapaTxt + mesesTxt;

    document.querySelectorAll(".aba[data-modo]").forEach((b) => {
      const ativo = b.getAttribute("data-modo") === estado.modo;
      b.classList.toggle("ativa", ativo);
      b.setAttribute("aria-selected", ativo ? "true" : "false");
    });

    $("#info-pagamento").innerHTML = `💰 <strong>Pagamento:</strong> ${ente.pagamento}`;

    const cinzasISO = window.CALENDARIOS[window.ANO_ATIVO].quartaDeCinzas;
    const cinzas = H.parse(cinzasISO);
    if (estado.ente === "usp") {
      $("#aviso-cinzas").innerHTML =
        `🔸 <strong>Quarta-feira de Cinzas (${H.fmt(cinzas)}/${window.ANO_ATIVO}):</strong> ` +
        `na USP as atividades ficam suspensas — tratada como dia não trabalhado (feriado).`;
    } else {
      $("#aviso-cinzas").innerHTML =
        `🔸 <strong>Quarta-feira de Cinzas (${H.fmt(cinzas)}/${window.ANO_ATIVO}):</strong> ` +
        `expediente de meio período — o dia é mais curto, mas você precisa comparecer. ` +
        `Por isso ele <strong>não é usado para montar emendas</strong>; fica só como aviso.`;
    }

    // aviso do que já foi escolhido (etapa 2)
    const avisoPlano = $("#aviso-plano");
    if (estado.plano.length) {
      const p = estado.plano[0];
      avisoPlano.style.display = "";
      avisoPlano.innerHTML =
        `✅ <strong>1º período já escolhido:</strong> ` +
        `${H.fmtExt(p.sugestao.inicioFerias)} → ${H.fmtExt(p.sugestao.fimFerias)} ` +
        `(${p.dias} dias). As opções abaixo já excluem datas que colidem.`;
    } else {
      avisoPlano.style.display = "none";
    }

    const restr = estado.etapa === 2
      ? restricoesDoPlano()
      : { diasEspeciaisDisponiveis: estado.usaEspeciais ? estado.diasEspeciais : 0 };
    let lista = Motor.calcular(estado.ente, estado.cidade, estado.dias, estado.modo, restr);
    const totalAntesFiltroMes = lista.length;

    // filtro de preferência de mês: mantém sugestões que INICIAM num mês escolhido
    const temFiltroMes = estado.mesesPreferidos && estado.mesesPreferidos.length;
    if (temFiltroMes) {
      const meses = new Set(estado.mesesPreferidos);
      lista = lista.filter((s) => meses.has(s.inicioFerias.getMonth()));
    }
    const topo = lista.slice(0, 20);

    const container = $("#lista-resultados");
    container.innerHTML = "";
    if (!topo.length) {
      container.appendChild(mensagemVazio(temFiltroMes, totalAntesFiltroMes > 0));
      return;
    }
    topo.forEach((r, i) => container.appendChild(cardResultado(r, i)));
  }

  /* Mensagem quando a lista fica vazia, com ação apropriada ao motivo. */
  function mensagemVazio(temFiltroMes, haviaAntesDoFiltro) {
    const box = el("div", "vazio-box");

    if (temFiltroMes && haviaAntesDoFiltro) {
      // o filtro de mês foi o responsável por zerar a lista
      const nomes = estado.mesesPreferidos.slice().sort((a, b) => a - b).map(nomeMesExtenso).join(", ");
      box.appendChild(el("p", "vazio",
        `😕 Nenhuma opção de <strong>${estado.dias} dias</strong> começa em <strong>${nomes}</strong>` +
        (estado.etapa === 2 ? ` sem colidir com o 1º período` : ``) + `.`));
      const btn = el("button", "btn-opcao", "📅 Escolher outros meses (ou todos)");
      btn.addEventListener("click", () => {
        renderPreferenciaMes();
        mostrarTela("tela-mes");
      });
      box.appendChild(btn);
    } else if (estado.etapa === 2) {
      // 2ª etapa sem filtro de mês: colisão com o 1º período
      box.appendChild(el("p", "vazio",
        `😕 Nenhuma opção de <strong>${estado.dias} dias</strong> foi encontrada sem colidir com o 1º período. ` +
        `Tente outro modo de cálculo ou finalize o plano.`));
    } else {
      box.appendChild(el("p", "vazio", "Nenhuma sugestão encontrada."));
    }
    return box;
  }

  function cardResultado(r, i) {
    const card = el("div", "card" + (i === 0 ? " card-top" : ""));

    const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    const ganhos = r.totalDescanso - r.diasFerias;
    const cab = el("div", "card-cab");
    cab.innerHTML =
      `<span class="posicao">${medalha}</span>` +
      `<span class="selos">` +
      `<span class="descanso">${r.totalDescanso} dias de descanso</span>` +
      `<span class="ganhos">+${ganhos} ${ganhos === 1 ? "dia ganho" : "dias ganhos"}</span>` +
      `</span>`;
    card.appendChild(cab);

    card.appendChild(linhasSugestao(r));

    card.appendChild(montarCalendarioVisual(r, estado.ente, estado.cidade));

    // botão de escolher este período
    const acoes = el("div", "card-acoes");
    const btn = el("button", "btn-escolher", "✓ Escolher este período");
    btn.addEventListener("click", () => escolherPeriodo(r));
    acoes.appendChild(btn);
    card.appendChild(acoes);

    return card;
  }

  /* Linhas descritivas de uma sugestão (reutilizadas na página final). */
  function linhasSugestao(r) {
    const frag = document.createDocumentFragment();

    const periodo = el("div", "linha-periodo");
    if (r.semFerias) {
      periodo.innerHTML =
        `🏖️ <strong>Sem gastar férias</strong> ` +
        `<span class="muted">(folga montada só com banco de horas / TRE)</span>`;
    } else {
      periodo.innerHTML =
        `🏖️ <strong>Férias:</strong> ${H.fmtExt(r.inicioFerias)} → ${H.fmtExt(r.fimFerias)} ` +
        `<span class="muted">(${r.diasFerias} dias)</span>`;
    }
    frag.appendChild(periodo);

    const bloco = el("div", "linha-bloco");
    bloco.innerHTML =
      `🧱 <strong>Folga corrida total:</strong> ${H.fmtExt(r.blocoInicio)} → ${H.fmtExt(r.blocoFim)}`;
    frag.appendChild(bloco);

    if (r.detalhesEmenda && r.detalhesEmenda.length) {
      const em = el("div", "linha-emenda");
      em.innerHTML = `🔗 <strong>Emendas aproveitadas:</strong> ` +
        r.detalhesEmenda.map((e) => `${H.fmt(e.dt)} (${e.motivo})`).join(" · ");
      frag.appendChild(em);
    }
    if (r.diasEspeciais && r.diasEspeciais.length) {
      const de = el("div", "linha-especial");
      de.innerHTML = `🏦 <strong>Folgas (banco de horas / TRE) usadas (${r.diasEspeciais.length}):</strong> ` +
        r.diasEspeciais.map((e) => H.fmtExt(e.dt)).join(" · ") +
        ` <span class="muted">(abatem só dias úteis)</span>`;
      frag.appendChild(de);
    }
    if (r.abonadas && r.abonadas.length) {
      const ab = el("div", "linha-abonada");
      ab.innerHTML = `✨ <strong>Abonadas sugeridas (${r.abonadas.length}):</strong> ` +
        r.abonadas.map((a) => H.fmtExt(a.dt)).join(" · ") +
        ` <span class="muted">(${regraAbonadasTexto()})</span>`;
      frag.appendChild(ab);
    }
    if (r.doacoes && r.doacoes.length) {
      const dc = el("div", "linha-doacao");
      dc.innerHTML = `🩸 <strong>Doação de sangue sugerida (${r.doacoes.length}):</strong> ` +
        r.doacoes.map((d) => H.fmtExt(d.dt)).join(" · ") +
        ` <span class="muted">(1 folga a cada 3 meses)</span>`;
      frag.appendChild(dc);
    }
    if (r.meiosPeriodo && r.meiosPeriodo.length) {
      const mp = el("div", "linha-meio");
      mp.innerHTML = `🕑 <strong>Pontes/meio período:</strong> ` +
        r.meiosPeriodo.map((m) => `${H.fmt(m.dt)} (${m.motivo})`).join(" · ");
      frag.appendChild(mp);
    }
    if (r.feriadosDesperdicados > 0) {
      const al = el("div", "linha-alerta");
      al.innerHTML = `⚠️ ${r.feriadosDesperdicados} feriado(s) caíram dentro das férias ` +
        `(dias que você teria de folga de qualquer forma).`;
      frag.appendChild(al);
    }
    return frag;
  }

  /* ---------- Escolha de período e decisão de continuar/finalizar ---------- */
  function escolherPeriodo(sugestao) {
    estado.plano.push({ sugestao, modo: estado.modo, dias: estado.dias });

    const ehUsp = estado.ente === "usp";
    const opcoes = estado.etapa === 1 ? opcoesRestantes(estado.dias, ehUsp) : [];

    // se há opções de 2º período E ainda estamos na 1ª etapa, pergunta
    if (opcoes.length && estado.etapa === 1) {
      renderDecisao(opcoes);
      mostrarTela("tela-decisao");
    } else {
      renderFinal();
      mostrarTela("tela-final");
    }
  }

  function renderDecisao(opcoes) {
    const p = estado.plano[0];
    $("#decisao-resumo").innerHTML =
      `✅ <strong>1º período escolhido:</strong> ${H.fmtExt(p.sugestao.inicioFerias)} → ` +
      `${H.fmtExt(p.sugestao.fimFerias)} (${p.dias} dias).`;
    $("#decisao-pergunta").textContent = opcoes.length > 1
      ? "Quantos dias você quer selecionar no 2º período?"
      : `Você quer selecionar os ${opcoes[0]} dias restantes?`;

    // Aviso de Limeira: a cota de "mês duplo" (2 abonadas num mesmo mês) só vale
    // para férias em PERÍODO ÚNICO. Se o 1º período usou 2 abonadas no mesmo mês
    // e o servidor FRACIONAR, essa vantagem não é permitida. Alertamos aqui.
    const aviso = $("#decisao-aviso-especial");
    if (aviso) {
      // O motor marca com `_duplo: true` a abonada que consumiu a cota de "mês
      // duplo" (2 abonadas no mesmo mês), vantagem exclusiva de período único.
      const usouMesDuplo = (p.sugestao.abonadas || []).some((a) => a._duplo);
      if (usouMesDuplo) {
        aviso.style.display = "";
        aviso.innerHTML =
          `⚠️ <strong>Atenção (Limeira):</strong> o 1º período usa <strong>2 abonadas no mesmo mês</strong>, ` +
          `o que só é permitido quando as férias são tiradas em <strong>período único</strong>. ` +
          `Se você <strong>dividir</strong> as férias (planejar um 2º período), essa vantagem não vale — ` +
          `nesse caso, reveja o 1º período ou finalize sem dividir.`;
      } else {
        aviso.style.display = "none";
      }
    }

    const wrap = $("#decisao-botoes");
    wrap.innerHTML = "";

    // um botão por opção de dias restantes (ex.: 15 oferece [15, 5])
    opcoes.forEach((dias) => {
      const b = el("button", "btn-opcao grande", `📅 Sim, planejar ${dias} dias`);
      b.addEventListener("click", () => {
        estado.etapa = 2;
        estado.dias = dias;
        estado.modo = "corridas";        // recomeça no modo padrão para a nova etapa
        estado.mesesPreferidos = [];     // nova etapa recomeça sem filtro de mês
        renderPreferenciaMes();          // também pergunta preferência de mês no 2º período
        mostrarTela("tela-mes");
      });
      wrap.appendChild(b);
    });

    const fimBtn = el("button", "btn-opcao grande btn-finalizar", "🏁 Finalizar meu plano");
    fimBtn.addEventListener("click", () => {
      renderFinal();
      mostrarTela("tela-final");
    });
    wrap.appendChild(fimBtn);
  }

  /* ---------- Página final ---------- */
  function renderFinal() {
    const ente = window.CALENDARIOS[window.ANO_ATIVO].entes[estado.ente];
    const totalDias = estado.plano.reduce((s, p) => s + p.dias, 0);
    const totalDescanso = estado.plano.reduce((s, p) => s + p.sugestao.totalDescanso, 0);
    const totalAbon = estado.plano.reduce((s, p) => s + (p.sugestao.abonadas || []).length, 0);
    const totalDoa = estado.plano.reduce((s, p) => s + (p.sugestao.doacoes || []).length, 0);
    const totalEsp = estado.plano.reduce((s, p) => s + (p.sugestao.diasEspeciais || []).length, 0);

    $("#final-cabecalho").innerHTML =
      `<strong>${ente.nome}</strong>` +
      (estado.ente === "usp" && estado.cidade ? ` — ${estado.cidade}` : "") +
      ` · ano ${window.ANO_ATIVO}`;

    // resumo numérico
    const resumo = $("#final-resumo");
    resumo.innerHTML =
      `<div class="final-num"><span>${totalDias}</span>dias de férias usados` +
      ` <small>(de ${TOTAL_FERIAS})</small></div>` +
      `<div class="final-num"><span>${totalDescanso}</span>dias de descanso no total</div>` +
      `<div class="final-num"><span>${totalAbon}</span>abonadas</div>` +
      `<div class="final-num"><span>${totalDoa}</span>doações de sangue</div>` +
      (totalEsp > 0 ? `<div class="final-num"><span>${totalEsp}</span>folgas banco/TRE</div>` : "");

    const sobra = TOTAL_FERIAS - totalDias;
    const ehUsp = estado.ente === "usp";
    if (sobra === 0) {
      $("#final-sobra").innerHTML = `✅ Você planejou todos os ${TOTAL_FERIAS} dias de férias do ano.`;
    } else if (ehUsp && totalDias === 20) {
      // 15+5 ou 5+15: compatível com quem vendeu 10 dias (abono pecuniário)
      $("#final-sobra").innerHTML =
        `✅ Você planejou <strong>20 dias</strong> de férias. ` +
        `Os outros <strong>10 dias</strong> podem ter sido vendidos (abono pecuniário).`;
    } else {
      $("#final-sobra").innerHTML =
        `ℹ️ Você ainda tem <strong>${sobra} dias</strong> de férias não planejados neste app` +
        (ehUsp ? ` (ou vendidos como abono pecuniário)` : ``) + `.`;
    }

    // períodos
    const cont = $("#final-periodos");
    cont.innerHTML = "";
    estado.plano.forEach((p, idx) => {
      const bloco = el("div", "final-periodo");
      bloco.appendChild(el("h3", null,
        `Período ${idx + 1} — ${p.dias} dias que se tornaram ` +
        `<span class="virou-dias">${p.sugestao.totalDescanso} dias</span>`));
      bloco.appendChild(linhasSugestao(p.sugestao));
      bloco.appendChild(montarCalendarioVisual(p.sugestao, estado.ente, estado.cidade));
      cont.appendChild(bloco);
    });

    // instruções de abonadas/doações consolidadas
    const instr = $("#final-instrucoes");
    const todasAbon = estado.plano.flatMap((p) => (p.sugestao.abonadas || []).map((a) => a.dt));
    const todasDoa = estado.plano.flatMap((p) => (p.sugestao.doacoes || []).map((d) => d.dt));
    let html = "";
    if (todasAbon.length) {
      html += `<p>✨ <strong>Abonadas a solicitar (${todasAbon.length}):</strong> ` +
        todasAbon.map((d) => H.fmtExt(d)).join(" · ") +
        ` — lembre-se: ${regraAbonadasTexto()}.</p>`;
    }
    if (todasDoa.length) {
      html += `<p>🩸 <strong>Doações de sangue (${todasDoa.length}):</strong> ` +
        todasDoa.map((d) => H.fmtExt(d)).join(" · ") +
        ` — respeite o intervalo de 3 meses entre doações.</p>`;
    }
    const todasEsp = estado.plano.flatMap((p) => (p.sugestao.diasEspeciais || []).map((e) => e.dt));
    if (todasEsp.length) {
      html += `<p>🏦 <strong>Folgas (banco de horas / TRE) a solicitar (${todasEsp.length}):</strong> ` +
        todasEsp.map((d) => H.fmtExt(d)).join(" · ") +
        ` — confirme o saldo disponível com o seu setor de pessoal.</p>`;
    }
    if (!html) html = `<p>Você não usou abonadas, doação de sangue nem folgas banco/TRE neste plano (apenas emendas de feriados).</p>`;
    instr.innerHTML = html;
  }

  /* ---------- Minicalendário (recebe ente/cidade p/ funcionar em qualquer tela) ---------- */
  function montarCalendarioVisual(r, ente, cidade) {
    const mapa = Motor.montarCalendario(ente, cidade);
    // No modo "só folgas" não há dias de férias para pintar.
    const setFerias = r.semFerias ? new Set() : intervaloSet(r.inicioFerias, r.fimFerias);
    const setAbonada = new Set((r.abonadas || []).map((a) => H.iso(a.dt)));
    const setDoacao = new Set((r.doacoes || []).map((a) => H.iso(a.dt)));
    const setEspecial = new Set((r.diasEspeciais || []).map((a) => H.iso(a.dt)));
    const setMeio = new Set((r.meiosPeriodo || []).map((a) => H.iso(a.dt)));

    const ini = r.blocoInicio, fim = r.blocoFim;
    const meses = [];
    let cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
    const ultimo = new Date(fim.getFullYear(), fim.getMonth(), 1);
    while (cur <= ultimo) { meses.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }

    const wrap = el("div", "mini-cal-wrap");
    meses.forEach((mref) => {
      const bloco = el("div", "mini-mes");
      const ano = mref.getFullYear(), mes = mref.getMonth();
      bloco.appendChild(el("div", "mini-mes-titulo", `${nomeMesExtenso(mes)} ${ano}`));
      const head = el("div", "mini-grid mini-head");
      ["D", "S", "T", "Q", "Q", "S", "S"].forEach((d) => head.appendChild(el("span", "mini-dow", d)));
      bloco.appendChild(head);
      const grid = el("div", "mini-grid");
      const primeiro = new Date(ano, mes, 1);
      for (let i = 0; i < primeiro.getDay(); i++) grid.appendChild(el("span", "mini-dia vazio", ""));
      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const dt = new Date(ano, mes, dia);
        const k = H.iso(dt);
        const classe = classeDoDia(dt, k, { mapa, setFerias, setAbonada, setDoacao, setEspecial, setMeio, ini, fim });
        const cel = el("span", "mini-dia " + classe, String(dia));
        const titulo = tituloDoDia(dt, k, mapa, setFerias, setAbonada, setDoacao, setEspecial);
        if (titulo) cel.title = titulo;
        grid.appendChild(cel);
      }
      bloco.appendChild(grid);
      wrap.appendChild(bloco);
    });

    const leg = el("div", "mini-legenda");
    leg.innerHTML =
      `<span class="lg lg-ferias"></span>Férias` +
      `<span class="lg lg-feriado"></span>Feriado` +
      `<span class="lg lg-abonada"></span>Abonada` +
      `<span class="lg lg-doacao"></span>Doação` +
      `<span class="lg lg-especial"></span>Banco/TRE` +
      `<span class="lg lg-ponte"></span>Ponte/facult.` +
      `<span class="lg lg-meio"></span>Meio período` +
      `<span class="lg lg-fds"></span>Fim de semana`;
    wrap.appendChild(leg);
    return wrap;
  }

  function intervaloSet(a, b) {
    const s = new Set();
    for (let d = new Date(a); d <= b; d = H.addDias(d, 1)) s.add(H.iso(d));
    return s;
  }

  function classeDoDia(dt, k, ctx) {
    const dentroBloco = dt >= new Date(ctx.ini.getFullYear(), ctx.ini.getMonth(), ctx.ini.getDate())
      && dt <= ctx.fim;
    if (!dentroBloco) {
      if (ctx.setFerias.has(k)) return "ferias";
      return H.ehFimDeSemana(dt) ? "fora fds-fora" : "fora";
    }
    if (ctx.setFerias.has(k)) return "ferias";
    if (ctx.setEspecial && ctx.setEspecial.has(k)) return "especial";
    if (ctx.setAbonada.has(k)) return "abonada";
    if (ctx.setDoacao.has(k)) return "doacao";
    const c = Motor.classificar(dt, ctx.mapa);
    if (c.estado === "folga" && !H.ehFimDeSemana(dt)) return "feriado";
    if (H.ehFimDeSemana(dt)) return "fds";
    if (c.estado === "facultativo") return "ponte";
    if (c.estado === "meio" || ctx.setMeio.has(k)) return "meio";
    return "util-dentro";
  }

  function tituloDoDia(dt, k, mapa, setFerias, setAbonada, setDoacao, setEspecial) {
    if (setFerias.has(k)) return "Férias";
    if (setEspecial && setEspecial.has(k)) return "Folga (banco de horas / TRE)";
    if (setAbonada.has(k)) return "Abonada";
    if (setDoacao.has(k)) return "Doação de sangue";
    const c = Motor.classificar(dt, mapa);
    if (c.motivo && c.motivo !== "Dia útil" && c.motivo !== "Fim de semana") return c.motivo;
    return "";
  }

  /* Texto da regra de abonadas do ente ativo, derivado de ente.abonadas
   * (ex.: "máx. 6/ano, 1 por mês" ou, para Limeira, "máx. 12/ano, 1 por mês
   * (2 em um único mês)"). */
  function regraAbonadasTexto() {
    const ente = window.CALENDARIOS[window.ANO_ATIVO].entes[estado.ente];
    const a = (ente && ente.abonadas) || { maxPorMes: 1, tetoAno: 6, mesesDuplosNoAno: 0 };
    let txt = `máx. ${a.tetoAno}/ano, ${a.maxPorMes} por mês`;
    if (a.mesesDuplosNoAno > 0) {
      txt += ` (${a.maxPorMes + 1} em ${a.mesesDuplosNoAno === 1 ? "um único mês" : a.mesesDuplosNoAno + " meses"} do ano, exceto se as férias forem divididas)`;
    }
    return txt;
  }

  function nomeMesExtenso(m) {
    return ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][m];
  }

  return { iniciar };
})();

// A inicialização é disparada por js/dados.js, DEPOIS que os JSON de feriados
// são carregados (fetch) e window.CALENDARIOS[ano] é montado. Expomos App no
// escopo global para o carregador poder chamá-lo.
window.App = App;
