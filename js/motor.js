/* =============================================================================
 * MOTOR DE CÁLCULO DE FÉRIAS E EMENDAS
 * -----------------------------------------------------------------------------
 * Independente de interface. Recebe:
 *   - enteId: "pmrp" | "usp"
 *   - cidade: (apenas USP) nome da cidade
 *   - diasFerias: 10 | 15 | 20 | 30
 *   - modo: "corridas" | "abonadas" | "abonadas_sem_doacao" | "doacao"
 * E produz uma lista ordenada (melhor -> pior) de sugestões.
 *
 * MODELO: cada "sugestão" representa UMA escolha isolada de quando tirar as
 * férias no ano. Portanto os limites anuais (6 abonadas/ano, doação a cada 3
 * meses) são do SERVIDOR ao longo do ano — como cada sugestão é um cenário
 * independente, aplicamos aqui apenas os limites que fazem sentido DENTRO de
 * uma única janela de férias:
 *   - Abonadas: no máximo 1 por mês-calendário (regra "1 por mês"), e no máximo
 *     o teto anual de 6 por janela (nunca atingido numa janela só).
 *   - Doação de sangue: no máximo 1 por janela (respeita o espaçamento de 3
 *     meses, já que uma janela de férias dura bem menos que isso).
 * A UI deixa claro que esses recursos são do saldo anual do servidor.
 *
 * Conceitos de dias:
 *   - "folga": fim de semana OU feriado cheio (não se trabalha).
 *   - "facultativo": ponto facultativo / ponte (não gasta nada; vira folga).
 *   - "meio": expediente de meio período (emenda parcial; conta meio dia).
 *   - "util": dia útil normal (só vira folga gastando férias/abonada/doação).
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
  function addDias(dt, n) {
    // soma em dias de calendário, imune a horário de verão
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  }
  function diffDias(a, b) {
    const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((b0 - a0) / MS_DIA);
  }
  function ehFimDeSemana(dt) { const g = dt.getDay(); return g === 0 || g === 6; }

  const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function fmt(dt) { return `${String(dt.getDate()).padStart(2, "0")}/${MESES[dt.getMonth()]}`; }
  function fmtExt(dt) { return `${DIAS_SEMANA[dt.getDay()]}, ${fmt(dt)}`; }

  function prioridadeTipo(t) { return t === "feriado" ? 3 : t === "facultativo" ? 2 : t === "meio" ? 1 : 0; }

  /* Monta o mapa de dias especiais do ano para o ente/cidade selecionados.
   * Retorna { "AAAA-MM-DD": { nome, tipo } }. */
  function montarCalendario(enteId, cidade) {
    const C = window.CALENDARIOS[2027];
    const mapa = {};
    // >= na comparação: a ÚLTIMA fonte de mesma prioridade sobrescreve (permite
    // que a versão local/"previsão" prevaleça sobre a nacional genérica).
    const add = (lista) => (lista || []).forEach((e) => {
      const atual = mapa[e.data];
      if (!atual || prioridadeTipo(e.tipo) > prioridadeTipo(atual.tipo)) {
        mapa[e.data] = { nome: e.nome, tipo: e.tipo };
      } else if (prioridadeTipo(e.tipo) === prioridadeTipo(atual.tipo)) {
        mapa[e.data] = { nome: e.nome, tipo: e.tipo }; // mesma prioridade: fonte mais específica vence
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
    }
    return mapa;
  }

  /* Classifica um dia: "folga" | "facultativo" | "meio" | "util". */
  function classificar(dt, mapa) {
    if (ehFimDeSemana(dt)) return { estado: "folga", motivo: "Fim de semana" };
    const esp = mapa[iso(dt)];
    if (esp) {
      if (esp.tipo === "feriado") return { estado: "folga", motivo: esp.nome };
      if (esp.tipo === "facultativo") return { estado: "facultativo", motivo: esp.nome };
      if (esp.tipo === "meio") return { estado: "meio", motivo: esp.nome };
    }
    return { estado: "util", motivo: "Dia útil" };
  }

  // Um dia "não exige trabalho" se é folga OU ponto facultativo (ponte).
  function ehLivre(dt, mapa) {
    const c = classificar(dt, mapa);
    return c.estado === "folga" || c.estado === "facultativo";
  }

  /* Config de recursos por modo. */
  function configModo(modo) {
    switch (modo) {
      case "corridas":            return { usarAbonadas: false, usarDoacao: false };
      case "abonadas":            return { usarAbonadas: true,  usarDoacao: true };
      case "abonadas_sem_doacao": return { usarAbonadas: true,  usarDoacao: false };
      case "doacao":              return { usarAbonadas: false, usarDoacao: true };
      default:                    return { usarAbonadas: false, usarDoacao: false };
    }
  }

  /* Avalia iniciar as férias numa data. Férias são dias CORRIDOS de calendário.
   * Expande o bloco de descanso incorporando folgas E pontos facultativos
   * colados nas pontas (facultativo não custa nada). */
  function avaliarInicio(inicio, diasFerias, mapa, modo) {
    const cfg = configModo(modo);
    const fimFerias = addDias(inicio, diasFerias - 1);

    const res = {
      modo,
      inicioFerias: new Date(inicio),
      fimFerias: new Date(fimFerias),
      diasFerias,
      blocoInicio: new Date(inicio),
      blocoFim: new Date(fimFerias),
      abonadas: [],
      doacoes: [],
      meiosPeriodo: [],
      pontesAproveitadas: [],
      detalhesEmenda: [],
      feriadosDesperdicados: 0
    };

    // Feriados cheios que caíram em dia útil DENTRO das férias (desperdício real)
    for (let d = new Date(inicio); d <= fimFerias; d = addDias(d, 1)) {
      const c = classificar(d, mapa);
      if (c.estado === "folga" && !ehFimDeSemana(d)) res.feriadosDesperdicados++;
    }

    // Expande as pontas por dias "livres" (folga + facultativo).
    expandirLivres(res, mapa);

    // Registra as emendas de ponta (feriados/facultativos em dia útil colados),
    // SEM contar fim de semana como mérito.
    registrarEmendasPonta(res, inicio, fimFerias, mapa);

    // Aplica recursos (abonada/doação) para furar dias úteis de ponte.
    if (cfg.usarAbonadas || cfg.usarDoacao) aplicarRecursos(res, mapa, cfg);

    res.totalDescanso = diffDias(res.blocoInicio, res.blocoFim) + 1;
    res.totalAbonadas = res.abonadas.length;
    res.totalDoacoes = res.doacoes.length;
    res.pontuacao = pontuar(res, mapa);
    return res;
  }

  /* Estende blocoInicio/blocoFim enquanto os vizinhos forem dias livres. */
  function expandirLivres(res, mapa) {
    let cursor = addDias(res.blocoFim, 1);
    while (ehLivre(cursor, mapa)) { res.blocoFim = new Date(cursor); cursor = addDias(cursor, 1); }
    cursor = addDias(res.blocoInicio, -1);
    while (ehLivre(cursor, mapa)) { res.blocoInicio = new Date(cursor); cursor = addDias(cursor, -1); }
  }

  function registrarEmendasPonta(res, inicio, fimFerias, mapa) {
    // dias livres imediatamente antes do início das férias
    let cursor = addDias(inicio, -1);
    while (ehLivre(cursor, mapa)) {
      const c = classificar(cursor, mapa);
      if (!ehFimDeSemana(cursor)) res.detalhesEmenda.unshift({ dt: new Date(cursor), motivo: c.motivo });
      cursor = addDias(cursor, -1);
    }
    // dias livres imediatamente depois do fim das férias
    cursor = addDias(fimFerias, 1);
    while (ehLivre(cursor, mapa)) {
      const c = classificar(cursor, mapa);
      if (!ehFimDeSemana(cursor)) res.detalhesEmenda.push({ dt: new Date(cursor), motivo: c.motivo });
      cursor = addDias(cursor, 1);
    }
  }

  /* Tenta usar abonadas e/ou doação para transformar dias ÚTEIS de ponte em
   * folga, grudando mais descanso. Olha até 2 dias úteis consecutivos em cada
   * ponta; só vale a pena se logo após houver um dia livre (ponte real). */
  function aplicarRecursos(res, mapa, cfg) {
    const abonadasPorMes = {}; // "AAAA-MM" -> true (1 abonada por mês)
    let doacaoUsada = false;   // 1 doação por janela

    function tentar(direcao) {
      // coleta dias ÚTEIS consecutivos a partir da ponta
      const uteis = [];
      let cursor = direcao === 1 ? addDias(res.blocoFim, 1) : addDias(res.blocoInicio, -1);
      for (let i = 0; i < 2; i++) {
        const c = classificar(cursor, mapa);
        if (c.estado === "util") { uteis.push(new Date(cursor)); cursor = addDias(cursor, direcao); }
        else if (c.estado === "meio") {
          // meio período: registra como emenda parcial, atravessa mas não gasta recurso
          res.meiosPeriodo.push({ dt: new Date(cursor), motivo: classificar(cursor, mapa).motivo });
          cursor = addDias(cursor, direcao);
          i--; // meio não conta como dia útil a cobrir
        } else break;
      }
      if (!uteis.length) return;
      // precisa haver dia livre logo após o conjunto de úteis p/ valer a ponte
      if (!ehLivre(cursor, mapa)) return;

      // ordena os úteis do mais próximo da ponta para o mais distante
      const ordem = direcao === 1 ? uteis : uteis.slice().reverse();
      const cobertos = [];
      for (const dia of ordem) {
        const mesKey = iso(dia).slice(0, 7);
        if (cfg.usarAbonadas && !abonadasPorMes[mesKey] && res.abonadas.length < 6) {
          abonadasPorMes[mesKey] = true;
          res.abonadas.push({ dt: dia, motivo: "Abonada (ponte)" });
          cobertos.push(dia);
        } else if (cfg.usarDoacao && !doacaoUsada) {
          doacaoUsada = true;
          res.doacoes.push({ dt: dia, motivo: "Doação de sangue (ponte)" });
          cobertos.push(dia);
        } else {
          break; // não há recurso p/ cobrir este dia -> ponte incompleta
        }
      }
      // Só estende o bloco se TODOS os dias úteis da ponte foram cobertos.
      if (cobertos.length === uteis.length) {
        expandirLivres(res, mapa); // agora o(s) dia(s) coberto(s) viram livres? não:
        // os dias cobertos não estão no mapa como livres, então estende manualmente
        if (direcao === 1) {
          let c2 = addDias(res.blocoFim, 1);
          // avança sobre os dias cobertos e depois sobre livres
          while (cobertos.some((x) => +x === +c2) || ehLivre(c2, mapa)) {
            res.blocoFim = new Date(c2); c2 = addDias(c2, 1);
          }
        } else {
          let c2 = addDias(res.blocoInicio, -1);
          while (cobertos.some((x) => +x === +c2) || ehLivre(c2, mapa)) {
            res.blocoInicio = new Date(c2); c2 = addDias(c2, -1);
          }
        }
      } else {
        // ponte incompleta: desfaz os recursos reservados nesta tentativa
        cobertos.forEach((dia) => {
          res.abonadas = res.abonadas.filter((a) => +a.dt !== +dia);
          res.doacoes = res.doacoes.filter((a) => +a.dt !== +dia);
        });
        if (cobertos.length) {
          // libera o flag de doação/mês caso tenha sido marcado
          doacaoUsada = res.doacoes.length > 0;
        }
      }
    }

    tentar(1);
    tentar(-1);
  }

  /* Pontuação: maximizar descanso por dia GASTO do saldo (férias+abonada+doação),
   * com bônus por emendas reais (feriados/facultativos em dia útil, nunca FDS). */
  function pontuar(res, mapa) {
    const diasGastos = res.diasFerias + res.abonadas.length + res.doacoes.length;
    const razao = res.totalDescanso / diasGastos;
    const bonusEmenda = res.detalhesEmenda.length * 1.0; // só feriados/facult. em dia útil
    const penalidade = res.feriadosDesperdicados * 1.5;  // feriado dentro das férias = jogado fora
    return razao * 10 + res.totalDescanso + bonusEmenda - penalidade
      + res.abonadas.length * 0.8 + res.doacoes.length * 0.4;
  }

  /* Gera e ordena todas as sugestões do ano para o modo escolhido. */
  function calcular(enteId, cidade, diasFerias, modo) {
    const mapa = montarCalendario(enteId, cidade);
    const inicioAno = new Date(2027, 0, 1);
    const fimAno = new Date(2027, 11, 31);
    const candidatos = [];

    for (let d = new Date(inicioAno); d <= fimAno; d = addDias(d, 1)) {
      const c = classificar(d, mapa);
      // Não iniciar férias em dia já livre (folga/facultativo) — desperdício.
      if (c.estado === "folga" || c.estado === "facultativo") continue;
      if (addDias(d, diasFerias - 1) > fimAno) break;
      candidatos.push(avaliarInicio(d, diasFerias, mapa, modo));
    }

    candidatos.sort((a, b) => b.pontuacao - a.pontuacao);

    // Dedup por BLOCO final; entre blocos iguais, mantém o de maior pontuação
    // (que já vem primeiro por causa do sort).
    const vistos = new Set();
    const unicos = [];
    for (const r of candidatos) {
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
    configModo,
    helpers: { parse, iso, addDias, diffDias, fmt, fmtExt, ehFimDeSemana, DIAS_SEMANA, MESES }
  };
})();
