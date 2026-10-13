/* =============================================================================
 * MOTOR DE CÁLCULO DE FÉRIAS E EMENDAS
 * -----------------------------------------------------------------------------
 * Independente de interface. Recebe:
 *   - enteId: "pmrp" | "usp"
 *   - cidade: (apenas USP) nome da cidade
 *   - diasFerias: 10 | 15 | 20 | 30
 * E produz uma lista ordenada (melhor -> pior) de sugestões.
 *
 * Conceitos:
 *   - "Dia não trabalhado": fim de semana OU feriado cheio.
 *   - "Emenda": dia útil isolado entre folgas que, se tirado (férias/abonada),
 *     une blocos de folga.
 *   - Pontuação: priorizamos o maior BLOCO DE FOLGA CORRIDA resultante e a
 *     melhor razão (dias de descanso / dias de férias efetivamente gastos).
 * ===========================================================================*/

const Motor = (function () {
  const MS_DIA = 86400000;

  function parse(dataISO) {
    const [a, m, d] = dataISO.split("-").map(Number);
    return new Date(a, m - 1, d);
  }
  function iso(dt) {
    const a = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${a}-${m}-${d}`;
  }
  function addDias(dt, n) { return new Date(dt.getTime() + n * MS_DIA); }
  function ehFimDeSemana(dt) { const g = dt.getDay(); return g === 0 || g === 6; }

  const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function fmt(dt) { return `${String(dt.getDate()).padStart(2, "0")}/${MESES[dt.getMonth()]}`; }
  function fmtExt(dt) { return `${DIAS_SEMANA[dt.getDay()]}, ${fmt(dt)}`; }

  /* Monta o mapa de dias especiais do ano para o ente/cidade selecionados.
   * Retorna { "AAAA-MM-DD": { nome, tipo } } com tipo em feriado|facultativo|meio */
  function montarCalendario(enteId, cidade) {
    const C = window.CALENDARIOS[2027];
    const mapa = {};
    const add = (lista) => (lista || []).forEach((e) => {
      // feriado cheio sempre vence; não rebaixar um feriado para facultativo
      const atual = mapa[e.data];
      if (!atual || prioridadeTipo(e.tipo) > prioridadeTipo(atual.tipo)) {
        mapa[e.data] = { nome: e.nome, tipo: e.tipo };
      }
    });

    add(C.nacionais);
    add(C.nacionaisFacultativos);

    const ente = C.entes[enteId];
    if (enteId === "pmrp") {
      add(ente.feriadosLocais);
      add(ente.estaduais);
      add(ente.facultativosLocais);
    } else if (enteId === "usp") {
      add(ente.estaduais);
      add(ente.facultativosGerais);
      if (cidade && ente.cidades[cidade]) add(ente.cidades[cidade]);
      // Recesso de fim de ano e Quarta de Cinzas já cobertos:
      // Quarta de Cinzas vem de nacionaisFacultativos (tipo "meio").
    }
    return mapa;
  }
  function prioridadeTipo(t) { return t === "feriado" ? 3 : t === "facultativo" ? 2 : 1; }

  /* Classifica um dia: retorna "folga" (não trabalha), "meio" ou "util". */
  function classificar(dt, mapa) {
    if (ehFimDeSemana(dt)) return { estado: "folga", motivo: "Fim de semana" };
    const k = iso(dt);
    const esp = mapa[k];
    if (esp) {
      if (esp.tipo === "feriado") return { estado: "folga", motivo: esp.nome };
      if (esp.tipo === "facultativo") return { estado: "facultativo", motivo: esp.nome };
      if (esp.tipo === "meio") return { estado: "meio", motivo: esp.nome };
    }
    return { estado: "util", motivo: "Dia útil" };
  }

  /* Gera uma sugestão a partir de uma data de início de férias e nº de dias.
   * As férias são dias CORRIDOS de calendário (padrão CLT/estatutário):
   * conta-se "diasFerias" dias de calendário a partir do início.
   * O motor então expande para fins de semana/feriados colados nas pontas,
   * medindo o bloco total de descanso. */
  function avaliarInicio(inicio, diasFerias, mapa, modo) {
    // Período de férias (corrido, em dias de calendário)
    const fimFerias = addDias(inicio, diasFerias - 1);

    // Expande para trás: dias não trabalhados imediatamente antes do início
    let ini = new Date(inicio);
    const antes = [];
    let cursor = addDias(ini, -1);
    while (true) {
      const c = classificar(cursor, mapa);
      if (c.estado === "folga") { antes.unshift({ dt: new Date(cursor), ...c }); cursor = addDias(cursor, -1); }
      else break;
    }
    // Expande para frente: dias não trabalhados logo após o fim
    const depois = [];
    cursor = addDias(fimFerias, 1);
    while (true) {
      const c = classificar(cursor, mapa);
      if (c.estado === "folga") { depois.push({ dt: new Date(cursor), ...c }); cursor = addDias(cursor, 1); }
      else break;
    }

    const blocoInicio = antes.length ? antes[0].dt : inicio;
    const blocoFim = depois.length ? depois[depois.length - 1].dt : fimFerias;
    const totalDescanso = Math.round((blocoFim - blocoInicio) / MS_DIA) + 1;

    // Conta quantos feriados cheios caíram em dia útil DENTRO das férias (desperdício)
    let feriadosDesperdicados = 0;
    for (let d = new Date(inicio); d <= fimFerias; d = addDias(d, 1)) {
      const c = classificar(d, mapa);
      if (c.estado === "folga" && !ehFimDeSemana(d)) feriadosDesperdicados++;
    }
    // Fins de semana dentro das férias (também "gastos")
    let fdsDentro = 0;
    for (let d = new Date(inicio); d <= fimFerias; d = addDias(d, 1)) {
      if (ehFimDeSemana(d)) fdsDentro++;
    }

    const resultado = {
      modo,
      inicioFerias: new Date(inicio),
      fimFerias: new Date(fimFerias),
      diasFerias,
      blocoInicio: new Date(blocoInicio),
      blocoFim: new Date(blocoFim),
      totalDescanso,
      diasAntes: antes.length,
      diasDepois: depois.length,
      feriadosDesperdicados,
      fdsDentro,
      abonadas: [],
      meiosPeriodo: [],
      detalhesEmenda: []
    };

    // Registra feriados colados nas pontas (as "emendas" que valorizam a escolha)
    antes.concat(depois).forEach((p) => {
      if (!ehFimDeSemana(p.dt)) resultado.detalhesEmenda.push({ dt: p.dt, motivo: p.motivo });
    });

    return resultado;
  }

  /* MODO 2: tenta usar abonadas (máx 6/ano, 1 por mês) para "furar" dias úteis
   * isolados nas pontas do bloco, grudando ainda mais folga.
   * Estratégia gulosa: olha até 3 dias úteis à frente/atrás e, se logo depois
   * houver folga, propõe abonar o(s) dia(s) útil(eis) de ponte. */
  function aplicarAbonadas(res, mapa, limitePorMes) {
    const usadasPorMes = {}; // "AAAA-MM" -> true
    let totalAbonadas = 0;
    const MAX_ANO = 6;

    function tentarPonte(direcao) {
      // direcao = +1 (depois do bloco) ou -1 (antes do bloco)
      let base = direcao === 1 ? addDias(res.blocoFim, 1) : addDias(res.blocoInicio, -1);
      const utilBuffer = [];
      let cursor = new Date(base);
      // junta até 3 dias úteis/facultativos consecutivos
      for (let i = 0; i < 3; i++) {
        const c = classificar(cursor, mapa);
        if (c.estado === "util" || c.estado === "facultativo" || c.estado === "meio") {
          utilBuffer.push({ dt: new Date(cursor), ...c });
          cursor = addDias(cursor, direcao);
        } else break;
      }
      if (!utilBuffer.length) return;
      // o próximo após o buffer precisa ser folga para valer a ponte
      const prox = classificar(cursor, mapa);
      const valePonte = prox.estado === "folga";
      // facultativo/meio não gastam abonada; só dias "util" gastam
      utilBuffer.forEach((u) => {
        if (totalAbonadas >= MAX_ANO) return;
        const chaveMes = iso(u.dt).slice(0, 7);
        if (u.estado === "facultativo") {
          res.meiosPeriodo.push({ dt: u.dt, motivo: u.motivo + " (não gasta abonada)" });
        } else if (u.estado === "meio") {
          res.meiosPeriodo.push({ dt: u.dt, motivo: u.motivo });
        } else if (u.estado === "util" && valePonte) {
          if (!usadasPorMes[chaveMes] && (limitePorMes ? true : true)) {
            usadasPorMes[chaveMes] = true;
            totalAbonadas++;
            res.abonadas.push({ dt: u.dt, motivo: "Abonada (ponte)" });
            // estende o bloco
            if (direcao === 1) res.blocoFim = new Date(cursor > res.blocoFim ? cursor : res.blocoFim);
            else res.blocoInicio = new Date(cursor < res.blocoInicio ? cursor : res.blocoInicio);
          }
        }
      });
      // reexpande folgas após abonar
      reexpandir(res, mapa);
    }

    tentarPonte(1);
    tentarPonte(-1);

    res.totalDescanso = Math.round((res.blocoFim - res.blocoInicio) / MS_DIA) + 1;
    res.totalAbonadas = totalAbonadas;
    return res;
  }

  function reexpandir(res, mapa) {
    // após abonar, folgas naturais podem se juntar; estende as pontas por folgas
    let cursor = addDias(res.blocoFim, 1);
    while (classificar(cursor, mapa).estado === "folga") { res.blocoFim = new Date(cursor); cursor = addDias(cursor, 1); }
    cursor = addDias(res.blocoInicio, -1);
    while (classificar(cursor, mapa).estado === "folga") { res.blocoInicio = new Date(cursor); cursor = addDias(cursor, -1); }
  }

  /* Pontuação: queremos MAIS descanso total por dia de férias gasto.
   * Bônus por iniciar/terminar colado em feriado (emenda real). */
  function pontuar(res) {
    const diasGastos = res.diasFerias + (res.totalAbonadas || 0);
    const razao = res.totalDescanso / diasGastos;
    const bonusEmenda = (res.diasAntes + res.diasDepois) * 0.5;
    const penalidade = res.feriadosDesperdicados * 1.5; // feriado dentro das férias é "jogado fora"
    return razao * 10 + res.totalDescanso + bonusEmenda - penalidade + (res.totalAbonadas || 0) * 0.8;
  }

  /* Gera e ordena todas as sugestões do ano. */
  function calcular(enteId, cidade, diasFerias, modo) {
    const mapa = montarCalendario(enteId, cidade);
    const inicioAno = new Date(2027, 0, 1);
    const fimAno = new Date(2027, 11, 31);
    const candidatos = [];

    for (let d = new Date(inicioAno); d <= fimAno; d = addDias(d, 1)) {
      // Só faz sentido iniciar férias em dia útil ou facultativo (não desperdiçar fds)
      const c = classificar(d, mapa);
      if (c.estado === "folga") continue;
      // garante que as férias caibam no ano
      if (addDias(d, diasFerias - 1) > fimAno) break;

      let res = avaliarInicio(d, diasFerias, mapa, modo);
      if (modo === "abonadas") res = aplicarAbonadas(res, mapa, true);
      res.pontuacao = pontuar(res);
      candidatos.push(res);
    }

    // ordena do melhor para o pior
    candidatos.sort((a, b) => b.pontuacao - a.pontuacao);

    // remove sugestões quase idênticas (mesmo bloco) mantendo a melhor
    const vistos = new Set();
    const unicos = [];
    for (const r of candidatos) {
      const chave = iso(r.blocoInicio) + "_" + iso(r.blocoFim) + "_" + iso(r.inicioFerias);
      const chaveBloco = iso(r.blocoInicio) + "_" + iso(r.blocoFim);
      if (vistos.has(chaveBloco)) continue;
      vistos.add(chaveBloco);
      unicos.push(r);
    }
    return unicos;
  }

  return {
    calcular,
    montarCalendario,
    classificar,
    helpers: { parse, iso, addDias, fmt, fmtExt, ehFimDeSemana, DIAS_SEMANA, MESES }
  };
})();
