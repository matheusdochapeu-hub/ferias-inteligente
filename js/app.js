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

    // navegação "voltar"
    document.querySelectorAll("[data-voltar]").forEach((b) =>
      b.addEventListener("click", () => mostrarTela(b.getAttribute("data-voltar")))
    );

    // dias de férias
    document.querySelectorAll(".btn-dias").forEach((b) =>
      b.addEventListener("click", () => {
        estado.dias = Number(b.getAttribute("data-dias"));
        renderResultados();
        mostrarTela("tela-resultados");
      })
    );

    // abas de modo
    $("#aba-corridas").addEventListener("click", () => { estado.modo = "corridas"; renderResultados(); });
    $("#aba-abonadas").addEventListener("click", () => { estado.modo = "abonadas"; renderResultados(); });
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

    // destaque das abas
    $("#aba-corridas").classList.toggle("ativa", estado.modo === "corridas");
    $("#aba-abonadas").classList.toggle("ativa", estado.modo === "abonadas");

    // info de pagamento (apenas informativo)
    $("#info-pagamento").innerHTML =
      `💰 <strong>Pagamento:</strong> ${ente.pagamento}`;

    // aviso quarta de cinzas
    $("#aviso-cinzas").innerHTML =
      `🔸 <strong>Quarta-feira de Cinzas (10/02/2027):</strong> expediente de meio período — ` +
      `ótimo para encurtar o dia, mas não é feriado cheio.`;

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

    return card;
  }

  return { iniciar };
})();

document.addEventListener("DOMContentLoaded", App.iniciar);
