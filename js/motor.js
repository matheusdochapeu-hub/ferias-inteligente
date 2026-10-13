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
    const C = window.CALENDARIOS[window.ANO_ATIVO];
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

    // ---- Captura de FERIADO/FACULTATIVO "ilha" próximo ----
    // Além das pontes coladas, olha mais longe (até alguns dias úteis) buscando
    // um FERIADO ou PONTO FACULTATIVO separado do bloco por dias úteis. Se der
    // para "pagar" esses dias úteis com os recursos disponíveis (abonada: 1/mês;
    // doação: 1/janela) E o ganho de dias livres capturados (o feriado + fins de
    // semana ao redor) compensar o custo, estende o bloco até lá.
    capturarIlha(1);
    capturarIlha(-1);

    function capturarIlha(direcao) {
      const MAX_ALCANCE = 4; // até 4 dias úteis entre o bloco e a ilha
      let cursor = direcao === 1 ? addDias(res.blocoFim, 1) : addDias(res.blocoInicio, -1);
      const uteis = [];
      // acumula dias úteis consecutivos; para ao encontrar o 1º dia livre (a ilha)
      for (let i = 0; i < MAX_ALCANCE; i++) {
        const c = classificar(cursor, mapa);
        if (c.estado === "util") { uteis.push(new Date(cursor)); cursor = addDias(cursor, direcao); }
        else break;
      }
      if (!uteis.length) return;
      const cIlha = classificar(cursor, mapa);
      // a ilha precisa começar com FERIADO ou FACULTATIVO em dia de semana
      // (um simples fim de semana já teria sido pego por expandirLivres/tentar)
      if (!(cIlha.estado === "folga" || cIlha.estado === "facultativo") || ehFimDeSemana(cursor)) return;

      // mede o ganho de dias LIVRES contíguos a partir da ilha (feriado + FDS/pontes)
      let ganho = 0;
      let p = new Date(cursor);
      while (ehLivre(p, mapa)) { ganho++; p = addDias(p, direcao); }
      // custo = dias úteis a comprar; só vale se ganho de folga > custo de recursos
      if (ganho <= uteis.length) return;

      // tenta reservar recursos para TODOS os dias úteis intermediários
      const reservasFeitas = [];
      let ok = true;
      for (const dia of uteis) {
        const tipo = reservar(dia);
        if (!tipo) { ok = false; break; }
        reservasFeitas.push({ dia, tipo });
      }
      if (!ok) { desfazer(reservasFeitas); return; } // não deu p/ pagar a ponte: aborta
      // sucesso: incorpora os dias comprados + a ilha livre
      recomputarBloco(res, mapa);
    }

    // ---- Abonadas "de ponta" avulsas ----
    // Mesmo sem uma ponte a fechar, uma abonada colada no 1º dia útil de uma
    // ponta já é um dia de folga — e, se o dia seguinte for livre (fim de
    // semana/feriado), "puxa" esse descanso também. Como a regra é 1 abonada por
    // mês, tentamos colar UMA abonada em CADA ponta (início e fim). Quando as
    // férias cruzam a virada de mês, as pontas caem em meses diferentes e cabem
    // as duas abonadas — rendendo tipicamente +2 (ou mais) dias de descanso.
    if (cfg.usarAbonadas) {
      // depois do fim: avança colando abonadas enquanto o próximo dia for útil,
      // houver abonada disponível no mês e isso resultar em ganho de folga.
      colarAbonadasNaPonta(1);
      colarAbonadasNaPonta(-1);
    }

    // IMPORTANTE (prioridade): esta função roda DEPOIS de `tentar` (pontes) e
    // `capturarIlha` (ilhas de feriado). Logo, se a abonada de um mês já foi
    // gasta para EMENDAR um feriado/ponte, o teste `abonadasNoMes(mesKey) < 1`
    // impede que uma segunda abonada do mesmo mês seja usada aqui. Ou seja: a
    // abonada só é colada na ponta como dia avulso quando NÃO foi necessária
    // para uma emenda naquele mês.
    function colarAbonadasNaPonta(direcao) {
      // A abonada é colada no 1º dia útil de cada ponta porque ela SEMPRE encosta
      // no bloco de descanso (que já inclui fins de semana, feriados e pontes).
      // Como sábado/domingo CONTAM como descanso, uma abonada numa sexta/segunda
      // (ou véspera de bloco) puxa esses dias livres junto — por isso quase sempre
      // rende bem mais que o próprio dia. No pior caso (bloco cercado de dias
      // úteis dos dois lados), rende ao menos +1 dia colado às férias, o que o
      // servidor quer. Só paramos quando não há mais dia útil na ponta, acabou o
      // saldo do mês (regra 1/mês), ou estouraria o teto anual de 6.
      //
      // Avaliamos o GANHO LÍQUIDO antes de confirmar: compramos o dia útil-alvo
      // e, se o resultado (após recomputarBloco) aumentar o total de descanso em
      // pelo menos 1, mantemos; senão desfazemos (segurança — na prática sempre
      // ganha, pois o dia comprado já é um dia de folga a mais no bloco).
      const MAX = 2; // no máx. 2 compras por direção (ex.: furar 1 ponte curta)
      for (let i = 0; i < MAX; i++) {
        const alvo = direcao === 1 ? addDias(res.blocoFim, 1) : addDias(res.blocoInicio, -1);
        const c = classificar(alvo, mapa);
        if (c.estado !== "util") break; // ponta já livre: recomputarBloco já cobriu
        const mesKey = iso(alvo).slice(0, 7);
        // abonada disponível p/ aquele mês (1/mês neste período, mês não usado em
        // outro período do plano) e dentro do teto anual de 6.
        if (!(abonadasNoMes(mesKey) < 1 && !mesesJaUsados.has(mesKey) && res.abonadas.length < 6)) break;

        // simula a compra e mede o ganho líquido de descanso
        const descAntes = diffDias(res.blocoInicio, res.blocoFim) + 1;
        const salvoIni = new Date(res.blocoInicio), salvoFim = new Date(res.blocoFim);
        abonadasPorMes[mesKey] = abonadasNoMes(mesKey) + 1;
        const marca = { dt: new Date(alvo), motivo: "Abonada (ponta das férias)" };
        res.abonadas.push(marca);
        if (direcao === 1) res.blocoFim = new Date(alvo);
        else res.blocoInicio = new Date(alvo);
        recomputarBloco(res, mapa); // incorpora o dia + puxa fins de semana/feriados colados
        const descDepois = diffDias(res.blocoInicio, res.blocoFim) + 1;

        if (descDepois - descAntes < 1) {
          // não houve ganho real -> desfaz a compra e encerra esta ponta
          abonadasPorMes[mesKey] = abonadasNoMes(mesKey) - 1;
          res.abonadas = res.abonadas.filter((a) => a !== marca);
          res.blocoInicio = salvoIni; res.blocoFim = salvoFim;
          break;
        }
        // rótulo: distingue emenda que puxou descanso extra de dia simples colado
        marca.motivo = (descDepois - descAntes) > 1
          ? "Abonada (emenda na ponta das férias)"
          : "Abonada (dia extra na ponta das férias)";
      }
    }

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
   * com bônus por emendas reais (feriados/facultativos em dia útil, nunca FDS).
   *
   * Nota: NÃO premiamos a simples quantidade de abonadas/doações usadas — isso
   * contrariaria o objetivo de "mais descanso por dia gasto" (duas opções com o
   * mesmo descanso, a que gasta MENOS recursos deve vencer). O mérito de gastar
   * um recurso já está refletido no ganho de `totalDescanso` e na `razao`. */
  function pontuar(res, mapa) {
    const diasGastos = res.diasFerias + res.abonadas.length + res.doacoes.length;
    const razao = res.totalDescanso / diasGastos;
    const bonusEmenda = res.detalhesEmenda.length * 1.0; // só feriados/facult. em dia útil
    const penalidade = res.feriadosDesperdicados * 1.5;  // feriado dentro das férias = jogado fora
    // Pequeno desempate: quando as férias CRUZAM a virada de mês, cabem abonadas
    // em meses diferentes (uma em cada ponta) — o que rende mais descanso. Este
    // bônus é só de desempate (não premia gasto de recurso: duas opções de mesmo
    // descanso e mesmo custo, prefere a que cruza o mês por ser mais flexível).
    const cruzaMes = res.inicioFerias.getMonth() !== res.fimFerias.getMonth() ? 0.5 : 0;
    return razao * 10 + res.totalDescanso + bonusEmenda - penalidade + cruzaMes;
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
    const ano = window.ANO_ATIVO;
    const inicioAno = new Date(ano, 0, 1);
    const fimAno = new Date(ano, 11, 31);
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

    // Deduplica por bloco de folga (mesmo blocoInicio_blocoFim = mesmo descanso).
    // Entre sugestões de bloco idêntico, preferimos a de MENOR custo de recursos
    // (abonadas + doações); havendo empate, a de maior pontuação (que já é a 1ª
    // encontrada, pois a lista vem ordenada por pontuação desc).
    const custoRecursos = (s) => s.abonadas.length + s.doacoes.length;
    const posPorBloco = new Map(); // chaveBloco -> índice em `unicos`
    const unicos = [];
    for (const sug of candidatos) {
      const chaveBloco = iso(sug.blocoInicio) + "_" + iso(sug.blocoFim);
      if (!posPorBloco.has(chaveBloco)) {
        posPorBloco.set(chaveBloco, unicos.length);
        unicos.push(sug);
      } else {
        const i = posPorBloco.get(chaveBloco);
        if (custoRecursos(sug) < custoRecursos(unicos[i])) unicos[i] = sug;
      }
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
