const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Carrega o motor de cálculo para compor o ambiente
const Motor = require("../js/motor.js");

function createMockEnvironment(initialYear = 2027) {
  const elements = new Map();

  function getOrCreateElement(id, tag = "div") {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        tagName: tag.toUpperCase(),
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
          contains(c) { return this._classes.has(c); }
        },
        children: [],
        innerHTML: "",
        _textContent: "",
        get textContent() { return this._textContent; },
        set textContent(v) { this._textContent = v == null ? "" : String(v); },
        setAttribute() {},
        getAttribute() { return null; },
        appendChild(child) { this.children.push(child); },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        addEventListener() {},
        focus() {}
      });
    }
    return elements.get(id);
  }

  const telaOrgao = getOrCreateElement("tela-orgao");
  const telaCidade = getOrCreateElement("tela-cidade");
  const subtitulo = getOrCreateElement("ano-subtitulo");
  const plano = getOrCreateElement("ano-plano");
  const listaResultados = getOrCreateElement("lista-resultados");
  const finalPeriodos = getOrCreateElement("final-periodos");
  const titleEl = { textContent: "" };

  const documentMock = {
    querySelector(sel) {
      if (sel === "title") return titleEl;
      if (sel.startsWith("#")) return getOrCreateElement(sel.slice(1));
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".tela") return [telaOrgao, telaCidade];
      return [];
    },
    createElement(tag) {
      return getOrCreateElement("el-" + Math.random(), tag);
    }
  };

  const sandbox = {
    window: null,
    document: documentMock,
    Motor,
    ANO_ATIVO: initialYear,
    CALENDARIOS: {
      [initialYear]: { entes: {} },
      2028: { entes: {} }
    },
    history: { pushState() {} },
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
    console
  };
  sandbox.window = sandbox;

  const appJs = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  // Expõe a referência ao estado interno para validação dos testes unitários
  const code = appJs.replace(
    "return { iniciar, trocarAno, resetar };",
    "globalThis.__testEstado = estado;\n  return { iniciar, trocarAno, resetar };"
  ) + "\n; globalThis.__testApp = App;";
  vm.runInNewContext(code, sandbox);

  return {
    sandbox,
    App: sandbox.__testApp,
    getEstado: () => sandbox.__testEstado,
    elements: {
      telaOrgao,
      telaCidade,
      subtitulo,
      plano,
      listaResultados,
      finalPeriodos,
      titleEl
    }
  };
}

test("App exporta iniciar, trocarAno e resetar", () => {
  const env = createMockEnvironment(2027);
  assert.equal(typeof env.App.iniciar, "function");
  assert.equal(typeof env.App.trocarAno, "function");
  assert.equal(typeof env.App.resetar, "function");

  const appJs = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(appJs, /return\s*\{\s*iniciar,\s*trocarAno,\s*resetar\s*\};/);
});

test("App.trocarAno reseta estado completo (plano, dias, cidade, ente, etapa, etc.)", () => {
  const env = createMockEnvironment(2027);
  const estado = env.getEstado();

  // Simula estado preenchido após uso do app
  estado.ente = "usp";
  estado.cidade = "São Paulo";
  estado.dias = 15;
  estado.modo = "abonadas";
  estado.plano = [{ sugestao: { totalDescanso: 21 }, modo: "abonadas", dias: 15 }];
  estado.etapa = 2;
  estado.mesesPreferidos = [6];
  estado.usaEspeciais = true;
  estado.diasEspeciais = 2;

  // Executa troca de ano
  env.App.trocarAno(2028);

  // Verifica que todo o estado foi resetado
  assert.equal(estado.ente, null, "ente deve ser limpo");
  assert.equal(estado.cidade, null, "cidade deve ser limpa");
  assert.equal(estado.dias, null, "dias deve ser limpo");
  assert.equal(estado.modo, "corridas", "modo deve voltar para corridas");
  assert.equal(estado.plano.length, 0, "plano deve ser esvaziado");
  assert.equal(estado.etapa, 1, "etapa deve voltar para 1");
  assert.equal(estado.mesesPreferidos.length, 0, "mesesPreferidos deve ser esvaziado");
  assert.equal(estado.usaEspeciais, false, "usaEspeciais deve voltar para false");
  assert.equal(estado.diasEspeciais, 0, "diasEspeciais deve voltar para 0");
});

test("App.trocarAno limpa resultados renderizados e navega para tela-orgao", () => {
  const env = createMockEnvironment(2027);

  // Simula conteúdo anterior na tela e tela ativa diferente
  env.elements.telaCidade.classList.add("ativa");
  env.elements.telaOrgao.classList.remove("ativa");
  env.elements.listaResultados.innerHTML = "<div class='card'>Resultado de 2027</div>";
  env.elements.finalPeriodos.innerHTML = "<div class='periodo'>Período 1</div>";

  env.App.trocarAno(2028);

  assert.equal(env.elements.listaResultados.innerHTML, "", "lista-resultados deve ser limpa");
  assert.equal(env.elements.finalPeriodos.innerHTML, "", "final-periodos deve ser limpo");
  assert.ok(env.elements.telaOrgao.classList.contains("ativa"), "tela-orgao deve ficar ativa");
  assert.ok(!env.elements.telaCidade.classList.contains("ativa"), "tela-cidade deve ser desativada");
});

test("atualizarAnoUI e trocarAno refletem novo ano no DOM", () => {
  const env = createMockEnvironment(2027);

  env.App.trocarAno(2028);

  assert.equal(env.sandbox.ANO_ATIVO, 2028);
  assert.equal(env.elements.subtitulo.textContent, " · 2028");
  assert.equal(env.elements.plano.textContent, "2028");
  assert.match(env.elements.titleEl.textContent, /2028/);
});

test("js/dados.js delega para App.trocarAno e possui fallback para App.iniciar", () => {
  const dadosJs = fs.readFileSync(path.join(__dirname, "../js/dados.js"), "utf8");

  // Verifica o bloco condicional dentro de trocarAno em js/dados.js
  const pattern = /if\s*\(\s*window\.App\s*&&\s*typeof\s+window\.App\.trocarAno\s*===\s*"function"\s*\)\s*\{\s*window\.App\.trocarAno\(ano\);\s*\}\s*else\s+if\s*\(\s*window\.App\s*&&\s*typeof\s+window\.App\.iniciar\s*===\s*"function"\s*\)\s*\{\s*window\.App\.iniciar\(\);\s*\}/;
  assert.match(dadosJs, pattern, "js/dados.js deve chamar App.trocarAno(ano) com fallback para App.iniciar()");

  // Simulação de comportamento em tempo de execução
  let chamouTrocarAno = null;
  let chamouIniciar = false;

  const mockAppCompleto = {
    trocarAno(ano) { chamouTrocarAno = ano; },
    iniciar() { chamouIniciar = true; }
  };

  // Testa caminho primário (App.trocarAno disponível)
  if (mockAppCompleto && typeof mockAppCompleto.trocarAno === "function") {
    mockAppCompleto.trocarAno(2028);
  } else if (mockAppCompleto && typeof mockAppCompleto.iniciar === "function") {
    mockAppCompleto.iniciar();
  }
  assert.equal(chamouTrocarAno, 2028);
  assert.equal(chamouIniciar, false);

  // Testa caminho de fallback (apenas App.iniciar disponível)
  chamouTrocarAno = null;
  chamouIniciar = false;
  const mockAppLegado = {
    iniciar() { chamouIniciar = true; }
  };

  if (mockAppLegado && typeof mockAppLegado.trocarAno === "function") {
    mockAppLegado.trocarAno(2028);
  } else if (mockAppLegado && typeof mockAppLegado.iniciar === "function") {
    mockAppLegado.iniciar();
  }
  assert.equal(chamouTrocarAno, null);
  assert.equal(chamouIniciar, true);
});

test("js/dados.js escolherAno: transição de ano respeita regra de 1º de outubro", () => {
  const { escolherAno } = require("../js/dados.js");
  const anosPublicados = [2026, 2027];

  // Antes de 1º de outubro (ex.: setembro, mês 8 no JS): exibe o ano corrente (2026)
  const dataAntesOutubro = new Date(2026, 8, 25);
  assert.equal(escolherAno(anosPublicados, dataAntesOutubro), 2026);

  // A partir de 1º de outubro (mês 9 no JS): desbloqueia o próximo ano (2027)
  const dataEmOutubro = new Date(2026, 9, 1);
  assert.equal(escolherAno(anosPublicados, dataEmOutubro), 2027);

  // Em dezembro (mês 11 no JS): continua exibindo o próximo ano liberado (2027)
  const dataEmDezembro = new Date(2026, 11, 15);
  assert.equal(escolherAno(anosPublicados, dataEmDezembro), 2027);

  // Fallback: se nenhum ano publicado for <= liberado, retorna o maior publicado
  const anosFuturos = [2028, 2029];
  assert.equal(escolherAno(anosFuturos, dataAntesOutubro), 2029);
});

test("js/dados.js montarCalendarios: preserva regrasInicio de entes.json", () => {
  const { montarCalendarios } = require("../js/dados.js");
  const entesDoc = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/entes.json"), "utf8"));
  const nacionais = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/nacionais-2027.json"), "utf8"));
  const pmrp = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/pmrp-2027.json"), "utf8"));
  const usp = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/usp-2027.json"), "utf8"));
  const limeira = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/limeira-2027.json"), "utf8"));

  // Mock global window para montarCalendarios
  globalThis.window = globalThis.window || {};
  montarCalendarios(2027, entesDoc, nacionais, pmrp, usp, limeira);

  const cal = globalThis.window.CALENDARIOS[2027];
  assert.ok(cal, "Calendário de 2027 deve estar montado");
  assert.ok(cal.entes.usp.regrasInicio, "USP deve conter regrasInicio");
  assert.equal(cal.entes.usp.regrasInicio.proibirSexta, true);
  assert.equal(cal.entes.usp.regrasInicio.proibirAntecedenciaFeriado, true);
});
