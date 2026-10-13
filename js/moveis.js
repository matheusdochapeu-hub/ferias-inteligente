/* =============================================================================
 * CÁLCULO LOCAL DE FERIADOS MÓVEIS (parte 2 da automação anual)
 * -----------------------------------------------------------------------------
 * Calcula, para qualquer ano, as datas que dependem da Páscoa — sem depender de
 * nenhuma API externa. É a base para o robô (parte 3) gerar o rascunho dos
 * feriados do ano seguinte.
 *
 * Datas derivadas da Páscoa (domingo):
 *   Carnaval (segunda)      = Páscoa - 48 dias
 *   Carnaval (terça)        = Páscoa - 47 dias
 *   Quarta-feira de Cinzas  = Páscoa - 46 dias (início da Quaresma)
 *   Sexta-feira Santa       = Páscoa - 2  dias
 *   Corpus Christi          = Páscoa + 60 dias
 *
 * Observações:
 *   - A própria Páscoa e a Quarta de Cinzas NÃO são feriados civis; são expostas
 *     porque o app/robô precisa delas (ex.: Cinzas é feriado na USP e meio
 *     período na PMRP; a data de Cinzas também vai no campo "quartaDeCinzas").
 *   - Finados (02/11), Natal (25/12) etc. são FIXOS e não entram aqui.
 *
 * Uso (navegador):  Moveis.feriadosMoveis(2028)
 * Uso (Node/robô):  const Moveis = require("./js/moveis.js");
 * ===========================================================================*/
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Moveis = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---- Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (Gregoriano).
   * Válido para qualquer ano do calendário gregoriano. Retorna um Date local. */
  function domingoDePascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia); // meia-noite local, imune a fuso
  }

  /* Soma dias de calendário a uma data (imune a horário de verão). */
  function addDias(dt, n) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  }

  /* Formata um Date como "AAAA-MM-DD" (string ISO de data, sem horário). */
  function iso(dt) {
    const a = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${a}-${m}-${d}`;
  }

  /* Devolve as datas móveis (objetos Date) de um ano. */
  function datasMoveis(ano) {
    const pascoa = domingoDePascoa(ano);
    return {
      pascoa,
      carnavalSegunda: addDias(pascoa, -48),
      carnavalTerca:   addDias(pascoa, -47),
      quartaDeCinzas:  addDias(pascoa, -46),
      sextaFeiraSanta: addDias(pascoa, -2),
      corpusChristi:   addDias(pascoa, 60)
    };
  }

  /* Devolve as datas móveis já em string ISO (prático para gerar JSON). */
  function datasMoveisISO(ano) {
    const d = datasMoveis(ano);
    const r = {};
    Object.keys(d).forEach((k) => { r[k] = iso(d[k]); });
    return r;
  }

  /* Gera as entradas de feriados móveis prontas para o JSON do app.
   *
   * Como o tratamento difere por ente, o retorno separa:
   *   - nacionaisFacultativos: Carnaval (seg/ter) — iguais para todos.
   *   - sextaSanta: Sexta-feira Santa (feriado nacional; já pode estar nos
   *     nacionais fixos, mas é móvel, então é devolvida aqui para o robô).
   *   - quartaDeCinzasISO: string da data (vai no campo "quartaDeCinzas").
   *   - corpusChristi / cinzas: devolvidos "crus" para o robô decidir o tipo
   *     conforme o ente (ex.: Cinzas = feriado na USP, meio período na PMRP;
   *     Corpus = feriado em ambos, mas a 6ª pós-Corpus é facultativa).
   *
   * marcarPrevisao: se true, acrescenta o sufixo " — previsão" aos nomes dos
   * itens que, por regra do projeto, dependem de confirmação humana. Por
   * padrão os móveis "duros" (Carnaval, Cinzas, Sexta Santa, Corpus) NÃO são
   * previsão — eles seguem de fórmula; a previsão fica para pontes/facultativos
   * que o robô replica à parte. */
  function entradasParaJSON(ano, opcoes) {
    opcoes = opcoes || {};
    const d = datasMoveis(ano);
    const sufixo = opcoes.marcarPrevisao ? " — previsão" : "";

    return {
      ano,
      quartaDeCinzasISO: iso(d.quartaDeCinzas),
      // Carnaval: facultativo nacional (seg + ter)
      nacionaisFacultativos: [
        { data: iso(d.carnavalSegunda), nome: "Carnaval (ponto facultativo)" + sufixo, tipo: "facultativo" },
        { data: iso(d.carnavalTerca),   nome: "Carnaval (ponto facultativo)" + sufixo, tipo: "facultativo" }
      ],
      // Sexta-feira Santa: feriado nacional (móvel)
      sextaFeiraSanta: { data: iso(d.sextaFeiraSanta), nome: "Paixão de Cristo (Sexta-feira Santa)", tipo: "feriado" },
      // Corpus Christi: feriado (o ente decide; na prática é feriado em PMRP e USP)
      corpusChristi:   { data: iso(d.corpusChristi), nome: "Corpus Christi", tipo: "feriado" },
      // Quarta de Cinzas: tipo varia por ente — o robô aplica conforme a regra
      quartaDeCinzas:  { data: iso(d.quartaDeCinzas), nome: "Quarta-feira de Cinzas", tipo: "variavel" }
    };
  }

  return {
    domingoDePascoa,
    datasMoveis,
    datasMoveisISO,
    entradasParaJSON,
    // utilitários expostos para reuso/testes
    _util: { addDias, iso }
  };
});
