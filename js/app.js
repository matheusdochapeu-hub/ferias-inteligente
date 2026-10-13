/* =============================================================================
 * CONTROLE DE INTERFACE (navegação entre telas e renderização)
 * ===========================================================================*/
const App = (function () {
  const H = Motor.helpers;

  const estado = {
    ente: null,     // "pmrp" | "usp"
    cidade: null,   // apenas USP
    dias: null,     // 10 | 15 | 20 | 30
    modo: "corridas" // "corridas" | "abonadas"
  };

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

  /* ---------- Tela 1: escolha do órgão ---------- */
  function iniciar() {
    $("#btn-pmrp").addEventListener("click", () => {
      estado.ente = "pmrp";
      estado.cidade = "Ribeirão Preto";
      mostrarTela("tela-dias");
      renderInfoEnte();
    });
    $("#btn-usp").addEventListener("click", () => {
      estado.ente = "usp";
      estado.cidade = null;
      renderCidades();
      mostrarTela("tela-cidade");
    });

    // navegação "voltar" / "recomeçar"
    document.querySelectorAll("[data-voltar]").forEach((b) =>
      b.addEventListener("click", () => {
        const alvo = b.getAttribute("data-voltar");
        if (alvo === "tela-orgao") resetar(); // recomeçar zera tudo
        mostrarTela(alvo);
      })
    );

    // dias de férias
    document.querySelectorAll(".btn-dias").forEach((b) =>
      b.addEventListener("click", () => {
        estado.dias = Number(b.getAttribute("data-dias"));
        renderResultados();
        mostrarTela("tela-resultados");
      })
    );

    // abas de modo (4 modos)
    document.querySelectorAll(".aba[data-modo]").forEach((b) =>
      b.addEventListener("click", () => {
        estado.modo = b.getAttribute("data-modo");
        renderResultados();
      })
    );
  }

  /* Zera o estado ao recomeçar, para não vazar escolhas entre sessões. */
  function resetar() {
    estado.ente = null;
    estado.cidade = null;
    estado.dias = null;
    estado.modo = "corridas";
  }

  /* ---------- Tela 2 (USP): escolha da cidade ---------- */
  function renderCidades() {
    const wrap = $("#grid-cidades");
    wrap.innerHTML = "";
    const cidades = Object.keys(window.CALENDARIOS[2027].entes.usp.cidades).sort((a, b) =>
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

  /* ---------- Tela 3: dias de férias (mostra qual órgão/cidade) ---------- */
  function renderInfoEnte() {
    const ente = window.CALENDARIOS[2027].entes[estado.ente];
    let txt = ente.nome;
    if (estado.ente === "usp" && estado.cidade) txt += " — " + estado.cidade;
    $("#info-ente").textContent = txt;
  }

  /* ---------- Tela 4: resultados ---------- */
  function renderResultados() {
    const ente = window.CALENDARIOS[2027].entes[estado.ente];
    $("#res-cabecalho").innerHTML =
      `<strong>${ente.nome}</strong>` +
      (estado.ente === "usp" && estado.cidade ? ` — ${estado.cidade}` : "") +
      ` &nbsp;·&nbsp; ${estado.dias} dias de férias &nbsp;·&nbsp; ano 2027`;

    // destaque das abas (4 modos) + estado ARIA
    document.querySelectorAll(".aba[data-modo]").forEach((b) => {
      const ativo = b.getAttribute("data-modo") === estado.modo;
      b.classList.toggle("ativa", ativo);
      b.setAttribute("aria-selected", ativo ? "true" : "false");
    });

    // info de pagamento (apenas informativo)
    $("#info-pagamento").innerHTML =
      `💰 <strong>Pagamento:</strong> ${ente.pagamento}`;

    // aviso quarta de cinzas (data vinda dos dados, não hardcoded)
    const cinzasISO = window.CALENDARIOS[2027].quartaDeCinzas;
    const cinzas = Motor.helpers.parse(cinzasISO);
    $("#aviso-cinzas").innerHTML =
      `🔸 <strong>Quarta-feira de Cinzas (${Motor.helpers.fmt(cinzas)}/2027):</strong> ` +
      `expediente de meio período — ótimo para encurtar o dia, mas não é feriado cheio.`;

    const lista = Motor.calcular(estado.ente, estado.cidade, estado.dias, estado.modo);
    const topo = lista.slice(0, 20); // melhores 20

    const container = $("#lista-resultados");
    container.innerHTML = "";

    if (!topo.length) {
      container.appendChild(el("p", "vazio", "Nenhuma sugestão encontrada."));
      return;
    }

    topo.forEach((r, i) => container.appendChild(cardResultado(r, i)));
  }

  function cardResultado(r, i) {
    const card = el("div", "card" + (i === 0 ? " card-top" : ""));

    const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    const cab = el("div", "card-cab");
    cab.innerHTML =
      `<span class="posicao">${medalha}</span>` +
      `<span class="descanso">${r.totalDescanso} dias de descanso</span>`;
    card.appendChild(cab);

    // linha principal: período de férias
    const periodo = el("div", "linha-periodo");
    periodo.innerHTML =
      `🏖️ <strong>Férias:</strong> ${H.fmtExt(r.inicioFerias)} → ${H.fmtExt(r.fimFerias)} ` +
      `<span class="muted">(${r.diasFerias} dias)</span>`;
    card.appendChild(periodo);

    // bloco total de folga (com emendas)
    const bloco = el("div", "linha-bloco");
    bloco.innerHTML =
      `🧱 <strong>Folga corrida total:</strong> ${H.fmtExt(r.blocoInicio)} → ${H.fmtExt(r.blocoFim)}`;
    card.appendChild(bloco);

    // emendas (feriados grudados)
    if (r.detalhesEmenda && r.detalhesEmenda.length) {
      const em = el("div", "linha-emenda");
      const itens = r.detalhesEmenda
        .map((e) => `${H.fmt(e.dt)} (${e.motivo})`)
        .join(" · ");
      em.innerHTML = `🔗 <strong>Emendas aproveitadas:</strong> ${itens}`;
      card.appendChild(em);
    }

    // abonadas sugeridas
    if (r.abonadas && r.abonadas.length) {
      const ab = el("div", "linha-abonada");
      const itens = r.abonadas.map((a) => H.fmtExt(a.dt)).join(" · ");
      ab.innerHTML =
        `✨ <strong>Abonadas sugeridas (${r.abonadas.length}):</strong> ${itens} ` +
        `<span class="muted">(máx. 6/ano, 1 por mês)</span>`;
      card.appendChild(ab);
    }

    // doação de sangue sugerida
    if (r.doacoes && r.doacoes.length) {
      const dc = el("div", "linha-doacao");
      const itens = r.doacoes.map((d) => H.fmtExt(d.dt)).join(" · ");
      dc.innerHTML =
        `🩸 <strong>Doação de sangue sugerida (${r.doacoes.length}):</strong> ${itens} ` +
        `<span class="muted">(1 folga a cada 3 meses)</span>`;
      card.appendChild(dc);
    }

    // meios períodos / pontes facultativas aproveitadas
    if (r.meiosPeriodo && r.meiosPeriodo.length) {
      const mp = el("div", "linha-meio");
      const itens = r.meiosPeriodo.map((m) => `${H.fmt(m.dt)} (${m.motivo})`).join(" · ");
      mp.innerHTML = `🕑 <strong>Pontes/meio período:</strong> ${itens}`;
      card.appendChild(mp);
    }

    // alerta de feriado "desperdiçado"
    if (r.feriadosDesperdicados > 0) {
      const al = el("div", "linha-alerta");
      al.innerHTML =
        `⚠️ ${r.feriadosDesperdicados} feriado(s) caíram dentro das férias ` +
        `(dias que você teria de folga de qualquer forma).`;
      card.appendChild(al);
    }

    // calendário visual
    card.appendChild(montarCalendarioVisual(r));

    return card;
  }

  /* Gera um minicalendário dos meses cobertos pelo bloco de folga, pintando
   * cada dia conforme seu papel (férias, feriado, abonada, doação, ponte...). */
  function montarCalendarioVisual(r) {
    const mapa = Motor.montarCalendario(estado.ente, estado.cidade);

    // Conjuntos auxiliares para classificação rápida
    const setFerias = intervaloSet(r.inicioFerias, r.fimFerias);
    const setAbonada = new Set((r.abonadas || []).map((a) => H.iso(a.dt)));
    const setDoacao = new Set((r.doacoes || []).map((a) => H.iso(a.dt)));
    const setMeio = new Set((r.meiosPeriodo || []).map((a) => H.iso(a.dt)));

    // Meses a exibir: do mês do blocoInicio ao mês do blocoFim
    const ini = r.blocoInicio;
    const fim = r.blocoFim;
    const meses = [];
    let cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
    const ultimo = new Date(fim.getFullYear(), fim.getMonth(), 1);
    while (cur <= ultimo) {
      meses.push(new Date(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    const wrap = el("div", "mini-cal-wrap");

    meses.forEach((mref) => {
      const bloco = el("div", "mini-mes");
      const ano = mref.getFullYear();
      const mes = mref.getMonth();
      bloco.appendChild(el("div", "mini-mes-titulo",
        `${nomeMesExtenso(mes)} ${ano}`));

      // cabeçalho dos dias da semana
      const head = el("div", "mini-grid mini-head");
      ["D", "S", "T", "Q", "Q", "S", "S"].forEach((d) =>
        head.appendChild(el("span", "mini-dow", d)));
      bloco.appendChild(head);

      const grid = el("div", "mini-grid");
      // espaços em branco até o 1º dia cair no dia da semana certo
      const primeiro = new Date(ano, mes, 1);
      for (let i = 0; i < primeiro.getDay(); i++) grid.appendChild(el("span", "mini-dia vazio", ""));

      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
      for (let dia = 1; dia <= diasNoMes; dia++) {
        const dt = new Date(ano, mes, dia);
        const k = H.iso(dt);
        const classe = classeDoDia(dt, k, { mapa, setFerias, setAbonada, setDoacao, setMeio, ini, fim });
        const cel = el("span", "mini-dia " + classe, String(dia));
        // dica (tooltip) com o motivo
        const titulo = tituloDoDia(dt, k, mapa, setFerias, setAbonada, setDoacao);
        if (titulo) cel.title = titulo;
        grid.appendChild(cel);
      }
      bloco.appendChild(grid);
      wrap.appendChild(bloco);
    });

    // legenda
    const leg = el("div", "mini-legenda");
    leg.innerHTML =
      `<span class="lg lg-ferias"></span>Férias` +
      `<span class="lg lg-feriado"></span>Feriado` +
      `<span class="lg lg-abonada"></span>Abonada` +
      `<span class="lg lg-doacao"></span>Doação` +
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

  /* Decide a classe visual de um dia. Prioridade: fora do bloco < fds < ponte
   * < feriado < doação < abonada < férias (as "ações do servidor" ficam no topo). */
  function classeDoDia(dt, k, ctx) {
    const dentroBloco = dt >= new Date(ctx.ini.getFullYear(), ctx.ini.getMonth(), ctx.ini.getDate())
      && dt <= ctx.fim;
    if (!dentroBloco) {
      // dia fora do período sugerido: mostra apagado (contexto)
      if (ctx.setFerias.has(k)) return "ferias"; // segurança
      return H.ehFimDeSemana(dt) ? "fora fds-fora" : "fora";
    }
    if (ctx.setFerias.has(k)) return "ferias";
    if (ctx.setAbonada.has(k)) return "abonada";
    if (ctx.setDoacao.has(k)) return "doacao";
    const c = Motor.classificar(dt, ctx.mapa);
    if (c.estado === "folga" && !H.ehFimDeSemana(dt)) return "feriado";
    if (H.ehFimDeSemana(dt)) return "fds";
    if (c.estado === "facultativo") return "ponte";
    if (c.estado === "meio" || ctx.setMeio.has(k)) return "meio";
    return "util-dentro"; // dia útil dentro do bloco mas sem marcação (raro)
  }

  function tituloDoDia(dt, k, mapa, setFerias, setAbonada, setDoacao) {
    if (setFerias.has(k)) return "Férias";
    if (setAbonada.has(k)) return "Abonada";
    if (setDoacao.has(k)) return "Doação de sangue";
    const c = Motor.classificar(dt, mapa);
    if (c.motivo && c.motivo !== "Dia útil" && c.motivo !== "Fim de semana") return c.motivo;
    return "";
  }

  function nomeMesExtenso(m) {
    return ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][m];
  }

  return { iniciar };
})();

document.addEventListener("DOMContentLoaded", App.iniciar);
