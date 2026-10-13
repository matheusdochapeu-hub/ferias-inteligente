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
  function avaliarInicio(inicio, diasFerias, mapa, modo, restricoes) {
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
    if (cfg.usarAbonadas || cfg.usarDoacao) aplicarRecursos(res, mapa, cfg, restricoes || {});

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

  /* Usa abonadas e/ou doação para "comprar" dias ÚTEIS nas pontas do bloco e
   * grudar mais descanso. Explora AS DUAS pontas, compartilhando o saldo:
   *   - Abonadas: 1 por mês-calendário (contador por "AAAA-MM").
   *   - Doação de sangue: 1 por janela.
   * Um dia útil só é comprado se a compra levar a um ganho real de folga, isto
   * é, se a extensão (contando este dia e os já comprados nesta ponta) alcançar
   * um dia livre (fim de semana / feriado / ponto facultativo).
   * Como as pontas podem estar em meses diferentes, é possível usar duas
   * abonadas (uma em cada mês) numa mesma janela de férias. */
  function aplicarRecursos(res, mapa, cfg, restricoes) {
    const abonadasPorMes = {}; // "AAAA-MM" -> qtd de abonadas já usadas NESTE período
    const mesesJaUsados = restricoes.mesesAbonadaUsados || new Set(); // de outro período do plano
    const doacoesPlano = restricoes.doacoesUsadas || []; // Date[] já marcadas no plano
    const DIST_DOACAO_DIAS = 90; // doação de sangue: 1 a cada ~3 meses

    function abonadasNoMes(mesKey) { return abonadasPorMes[mesKey] || 0; }

    // doação só é permitida se estiver a >=90 dias de qualquer doação já no plano
    function doacaoPermitida(dia) {
      return doacoesPlano.every((d) => Math.abs(diffDias(d, dia)) >= DIST_DOACAO_DIAS);
    }

    // tenta reservar um recurso para "comprar" o dia (prioriza abonada, senão doação)
    function reservar(dia) {
      const mesKey = iso(dia).slice(0, 7);
      // abonada: 1 por mês neste período E o mês não pode ter sido usado em outro período
      if (cfg.usarAbonadas && abonadasNoMes(mesKey) < 1 && !mesesJaUsados.has(mesKey) && res.abonadas.length < 6) {
        abonadasPorMes[mesKey] = abonadasNoMes(mesKey) + 1;
        res.abonadas.push({ dt: new Date(dia), motivo: "Abonada (ponte)" });
        return "abonada";
      }
      // doação: 1 por período e respeitando 3 meses de distância das do plano
      if (cfg.usarDoacao && res.doacoes.length < 1 && doacaoPermitida(dia)) {
        res.doacoes.push({ dt: new Date(dia), motivo: "Doação de sangue (ponte)" });
        return "doacao";
      }
      return null;
    }

    function tentar(direcao) {
      // Caminha a partir da ponta somando dias úteis "candidatos" a compra.
      // Quando encontra um dia livre, confirma a compra de todos os candidatos
      // acumulados até ali (ponte fechada) e segue incorporando os livres.
      let cursor = direcao === 1 ? addDias(res.blocoFim, 1) : addDias(res.blocoInicio, -1);
      let candidatos = [];        // dias úteis ainda não confirmados nesta ponta
      const MAX_UTEIS_PONTE = 3;  // limite de dias úteis "furados" por ponte

      while (true) {
        const c = classificar(cursor, mapa);

        if (c.estado === "util") {
          if (candidatos.length >= MAX_UTEIS_PONTE) break;
          candidatos.push(new Date(cursor));
          cursor = addDias(cursor, direcao);
          continue;
        }

        if (c.estado === "meio") {
          // meio período: emenda parcial; não gasta recurso e não bloqueia a ponte
          res.meiosPeriodo.push({ dt: new Date(cursor), motivo: c.motivo });
          cursor = addDias(cursor, direcao);
          continue;
        }

        if (c.estado === "folga" || c.estado === "facultativo") {
          // Dia livre: fecha a ponte. Tenta comprar todos os candidatos pendentes.
          if (candidatos.length) {
            const reservasFeitas = [];
            let ok = true;
            for (const dia of candidatos) {
              const tipo = reservar(dia);
              if (!tipo) { ok = false; break; }
              reservasFeitas.push({ dia, tipo });
            }
            if (!ok) {
              // não deu para comprar todos -> desfaz e encerra esta ponta
              desfazer(reservasFeitas, abonadasPorMes);
              break;
            }
            candidatos = []; // confirmados; continuam contando como parte do bloco
          }
          // incorpora o dia livre e segue (pode haver mais pontes adiante)
          if (direcao === 1) res.blocoFim = new Date(cursor);
          else res.blocoInicio = new Date(cursor);
          cursor = addDias(cursor, direcao);
          continue;
        }

        break; // qualquer outro caso encerra
      }

      // Após o loop, estende o bloco por sobre os dias comprados + livres,
      // garantindo que blocoFim/blocoInicio reflitam todos os dias já cobertos.
      recomputarBloco(res, mapa);
    }

    function desfazer(reservas) {
      reservas.forEach(({ dia, tipo }) => {
        if (tipo === "abonada") {
          const mesKey = iso(dia).slice(0, 7);
          abonadasPorMes[mesKey] = Math.max(0, abonadasNoMes(mesKey) - 1);
          res.abonadas = res.abonadas.filter((a) => +a.dt !== +dia);
        } else if (tipo === "doacao") {
          res.doacoes = res.doacoes.filter((a) => +a.dt !== +dia);
        }
      });
    }

    tentar(1);
    tentar(-1);

    // ---- Doação de sangue "avulsa" ----
    // Se o modo usa doação mas ela não foi aproveitada como ponte, anexa-a a uma
    // ponta do bloco para render pelo menos +1 dia de folga. Assim o modo
    // "abonadas + doação" sempre entrega ao menos 1 dia a mais que "só abonadas".
    if (cfg.usarDoacao && res.doacoes.length === 0) {
      const depois = addDias(res.blocoFim, 1);
      const antes = addDias(res.blocoInicio, -1);
      const podeDepois = classificar(depois, mapa).estado === "util" && doacaoPermitida(depois);
      const podeAntes = classificar(antes, mapa).estado === "util" && doacaoPermitida(antes);

      // Preferimos a ponta que já encosta num fim de semana logo em seguida
      // (maior chance de "puxar" folga extra ao reexpandir); senão, qualquer uma.
      let escolhido = null;
      if (podeDepois && ehLivre(addDias(depois, 1), mapa)) escolhido = { dia: depois, dir: 1 };
      else if (podeAntes && ehLivre(addDias(antes, -1), mapa)) escolhido = { dia: antes, dir: -1 };
      else if (podeDepois) escolhido = { dia: depois, dir: 1 };
      else if (podeAntes) escolhido = { dia: antes, dir: -1 };

      if (escolhido) {
        res.doacoes.push({ dt: new Date(escolhido.dia), motivo: "Doação de sangue (dia extra na ponta)" });
        if (escolhido.dir === 1) res.blocoFim = new Date(escolhido.dia);
        else res.blocoInicio = new Date(escolhido.dia);
        recomputarBloco(res, mapa); // pode puxar um fim de semana colado
      }
    }
  }

  /* Recalcula blocoInicio/blocoFim cobrindo dias livres E dias comprados
   * (abonadas/doações), de forma que o bloco seja realmente contíguo. */
  function recomputarBloco(res, mapa) {
    const comprados = new Set(
      res.abonadas.map((a) => +a.dt).concat(res.doacoes.map((d) => +d.dt))
    );
    const coberto = (dt) => ehLivre(dt, mapa) || comprados.has(+new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
    let cursor = addDias(res.blocoFim, 1);
    while (coberto(cursor)) { res.blocoFim = new Date(cursor); cursor = addDias(cursor, 1); }
    cursor = addDias(res.blocoInicio, -1);
    while (coberto(cursor)) { res.blocoInicio = new Date(cursor); cursor = addDias(cursor, -1); }
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

  /* Gera e ordena todas as sugestões do ano para o modo escolhido.
   *
   * restricoes (opcional) — usado no fracionamento (2º período de férias):
   *   {
   *     diasBloqueados: Set<string ISO>,  // dias cobertos por outro período já
   *                                       // escolhido (bloco inteiro). Sugestões
   *                                       // que toquem qualquer um são descartadas.
   *     mesesAbonadaUsados: Set<"AAAA-MM">, // meses em que já há abonada marcada
   *     doacoesUsadas: [Date],            // doações já marcadas no plano
   *   }
   */
  function calcular(enteId, cidade, diasFerias, modo, restricoes) {
    const mapa = montarCalendario(enteId, cidade);
    const inicioAno = new Date(2027, 0, 1);
    const fimAno = new Date(2027, 11, 31);
    const candidatos = [];
    const r = restricoes || {};

    for (let d = new Date(inicioAno); d <= fimAno; d = addDias(d, 1)) {
      const c = classificar(d, mapa);
      // Não iniciar férias em dia já livre (folga/facultativo) — desperdício.
      if (c.estado === "folga" || c.estado === "facultativo") continue;
      if (addDias(d, diasFerias - 1) > fimAno) break;

      const sug = avaliarInicio(d, diasFerias, mapa, modo, r);
      // Descarta sugestões cujo BLOCO toque qualquer dia bloqueado (regra B).
      if (r.diasBloqueados && blocoColide(sug, r.diasBloqueados)) continue;
      candidatos.push(sug);
    }

    candidatos.sort((a, b) => b.pontuacao - a.pontuacao);

    const vistos = new Set();
    const unicos = [];
    for (const sug of candidatos) {
      const chaveBloco = iso(sug.blocoInicio) + "_" + iso(sug.blocoFim);
      if (vistos.has(chaveBloco)) continue;
      vistos.add(chaveBloco);
      unicos.push(sug);
    }
    return unicos;
  }

  /* Verifica se o bloco de folga de uma sugestão toca algum dia bloqueado. */
  function blocoColide(sug, diasBloqueados) {
    for (let d = new Date(sug.blocoInicio); d <= sug.blocoFim; d = addDias(d, 1)) {
      if (diasBloqueados.has(iso(d))) return true;
    }
    return false;
  }

  return {
    calcular,
    montarCalendario,
    classificar,
    configModo,
    helpers: { parse, iso, addDias, diffDias, fmt, fmtExt, ehFimDeSemana, DIAS_SEMANA, MESES }
  };
})();
