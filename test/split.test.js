const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 1. Carrega dados e feriados de 2027
const entesDoc = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/entes.json"), "utf8"));
const nacionais2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/nacionais-2027.json"), "utf8"));
const pmrp2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/pmrp-2027.json"), "utf8"));
const usp2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/usp-2027.json"), "utf8"));
const limeira2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/limeira-2027.json"), "utf8"));

const entes = entesDoc.entes;
const abonadaPadrao = { maxPorMes: 1, tetoAno: 6, mesesDuplosNoAno: 0 };

globalThis.CALENDARIOS = {
  2027: {
    ano: nacionais2027.ano,
    quartaDeCinzas: nacionais2027.quartaDeCinzas,
    nacionais: nacionais2027.nacionais || [],
    nacionaisFacultativos: nacionais2027.nacionaisFacultativos || [],
    entes: {
      usp: {
        id: entes.usp.id,
        nome: entes.usp.nome,
        nomeCurto: entes.usp.nomeCurto,
        esfera: entes.usp.esfera,
        pagamento: entes.usp.pagamento,
        abonadas: entes.usp.abonadas || abonadaPadrao,
        estaduais: usp2027.estaduais || [],
        facultativosGerais: usp2027.facultativosGerais || [],
        cidades: usp2027.cidades || {},
        _observacao: usp2027._observacao
      },
      pmrp: {
        id: entes.pmrp.id,
        nome: entes.pmrp.nome,
        nomeCurto: entes.pmrp.nomeCurto,
        esfera: entes.pmrp.esfera,
        pagamento: entes.pmrp.pagamento,
        abonadas: entes.pmrp.abonadas || abonadaPadrao,
        feriadosLocais: pmrp2027.feriadosLocais || [],
        estaduais: pmrp2027.estaduais || [],
        facultativosLocais: pmrp2027.facultativosLocais || [],
        _observacao: pmrp2027._observacao
      },
      limeira: {
        id: entes.limeira.id,
        nome: entes.limeira.nome,
        nomeCurto: entes.limeira.nomeCurto,
        esfera: entes.limeira.esfera,
        pagamento: entes.limeira.pagamento,
        abonadas: entes.limeira.abonadas || abonadaPadrao,
        feriadosLocais: limeira2027.feriadosLocais || [],
        estaduais: limeira2027.estaduais || [],
        facultativosLocais: limeira2027.facultativosLocais || [],
        _observacao: limeira2027._observacao
      }
    }
  }
};
globalThis.ANO_ATIVO = 2027;

const Motor = require("../js/motor.js");

function createMockEnvironment() {
  const elements = new Map();
  let telaAtiva = "tela-orgao";

  function getOrCreateElement(id, tag = "div") {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        tagName: tag.toUpperCase(),
        classList: {
          _classes: new Set(),
          add(c) {
            this._classes.add(c);
            if (c === "ativa") telaAtiva = id;
          },
          remove(c) {
            this._classes.delete(c);
            if (c === "ativa" && telaAtiva === id) telaAtiva = null;
          },
          toggle(c, force) {
            if (force === undefined) {
              if (this._classes.has(c)) this.remove(c);
              else this.add(c);
            } else if (force) {
              this.add(c);
            } else {
              this.remove(c);
            }
          },
          contains(c) { return this._classes.has(c); }
        },
        children: [],
        innerHTML: "",
        _textContent: "",
        get textContent() { return this._textContent; },
        set textContent(v) { this._textContent = v == null ? "" : String(v); },
        dataset: {},
        style: {},
        _attributes: new Map(),
        setAttribute(k, v) { this._attributes.set(k, v); },
        getAttribute(k) { return this._attributes.has(k) ? this._attributes.get(k) : null },
        appendChild(child) { this.children.push(child); },
        querySelector(sel) {
          if (sel.startsWith("#")) return getOrCreateElement(sel.slice(1));
          return null;
        },
        querySelectorAll(sel) {
          if (sel === ".btn-mes") return [];
          if (sel === ".aba[data-modo]") return [];
          return [];
        },
        addEventListener(event, handler) {
          if (!this._listeners) this._listeners = {};
          if (!this._listeners[event]) this._listeners[event] = [];
          this._listeners[event].push(handler);
        },
        click() {
          if (this._listeners && this._listeners.click) {
            this._listeners.click.forEach((fn) => fn({ target: this }));
          }
        },
        focus() {}
      });
    }
    return elements.get(id);
  }

  const telas = [
    "tela-orgao", "tela-cidade", "tela-dias", "tela-mes",
    "tela-resultados", "tela-decisao", "tela-final"
  ].map((id) => getOrCreateElement(id));

  const documentMock = {
    querySelector(sel) {
      if (sel === "title") return { textContent: "" };
      if (sel.startsWith("#")) return getOrCreateElement(sel.slice(1));
      if (sel === ".abas") return getOrCreateElement("abas-container");
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".tela") return telas;
      if (sel === "[data-voltar]") return [];
      if (sel === ".btn-dias") return [];
      if (sel === ".aba[data-modo]") return [];
      if (sel === "[data-usp-only]") return [];
      return [];
    },
    createElement(tag) {
      return getOrCreateElement("el-" + Math.random(), tag);
    },
    createDocumentFragment() {
      return {
        children: [],
        appendChild(child) { this.children.push(child); }
      };
    }
  };

  const sandbox = {
    window: null,
    document: documentMock,
    Motor,
    ANO_ATIVO: 2027,
    CALENDARIOS: globalThis.CALENDARIOS,
    history: { pushState() {} },
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
    console
  };
  sandbox.window = sandbox;

  const appJs = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const code = appJs.replace(
    "return { iniciar, trocarAno, resetar };",
    `globalThis.__testEstado = estado;
     globalThis.__testOpcoesRestantes = opcoesRestantes;
     globalThis.__testPeriodosDeFerias = periodosDeFeriasEscolhidos;
     globalThis.__testEscolherPeriodo = escolherPeriodo;
     globalThis.__testRenderDecisao = renderDecisao;
     globalThis.__testRestricoesDoPlano = restricoesDoPlano;
     globalThis.__testRenderFinal = renderFinal;
     return { iniciar, trocarAno, resetar };`
  ) + "\n; globalThis.__testApp = App;";

  vm.runInNewContext(code, sandbox);

  return {
    App: sandbox.__testApp,
    getEstado: () => sandbox.__testEstado,
    opcoesRestantes: sandbox.__testOpcoesRestantes,
    periodosDeFeriasEscolhidos: sandbox.__testPeriodosDeFerias,
    escolherPeriodo: sandbox.__testEscolherPeriodo,
    renderDecisao: sandbox.__testRenderDecisao,
    restricoesDoPlano: sandbox.__testRestricoesDoPlano,
    renderFinal: sandbox.__testRenderFinal,
    getTelaAtiva: () => telaAtiva,
    getOrCreateElement
  };
}

test("opcoesRestantes: permite planejar férias após 0 dias de folgas (banco de horas / TRE)", () => {
  const { opcoesRestantes } = createMockEnvironment();

  // Para ente comum (não-USP), 0 dias oferece [30, 20, 15, 10]
  const opcoesComum = [...opcoesRestantes(0, false)];
  assert.deepEqual(opcoesComum, [30, 20, 15, 10]);
  assert.ok(opcoesComum.includes(15), "Deve permitir escolher 15 dias de férias após 0 dias");

  // Para USP, 0 dias oferece [30, 20, 15, 10, 5]
  const opcoesUsp = [...opcoesRestantes(0, true)];
  assert.deepEqual(opcoesUsp, [30, 20, 15, 10, 5]);
  assert.ok(opcoesUsp.includes(5), "USP deve permitir escolher 5 dias de férias após 0 dias");

  // Após escolher 15 dias, restam 15 dias
  const opcoesApos15 = [...opcoesRestantes(15, false)];
  assert.deepEqual(opcoesApos15, [15], "Após 15 dias deve restar opção de 15 dias");

  // Na USP, após 15 dias oferece 15 e 5 (venda de 10)
  const opcoesUsp15 = [...opcoesRestantes(15, true)];
  assert.deepEqual(opcoesUsp15, [15, 5], "USP após 15 dias deve permitir 15 ou 5 dias");

  // Após 30 dias de férias corridas, não restam opções de férias
  const opcoesApos30 = [...opcoesRestantes(30, false)];
  assert.deepEqual(opcoesApos30, [], "Após 30 dias não há dias restantes de férias");
});

test("Fluxo multi-período: 0 dias (folgas) + 15 dias férias + 15 dias férias", () => {
  const env = createMockEnvironment();
  const estado = env.getEstado();

  estado.ente = "pmrp";
  estado.cidade = "Ribeirão Preto";
  estado.usaEspeciais = true;
  estado.diasEspeciais = 2;
  estado.dias = 0;
  estado.etapa = 1;

  // 1. Gera e escolhe bloco de comp-time (0 dias de férias)
  const sugestoesZero = Motor.calcular("pmrp", null, 0, "corridas", { diasEspeciaisDisponiveis: 2 });
  assert.ok(sugestoesZero.length > 0, "Deve encontrar sugestões para 0 dias com saldo de especiais");
  const blocoZero = sugestoesZero[0];
  assert.equal(blocoZero.diasFerias, 0);
  assert.equal(blocoZero.semFerias, true);

  env.escolherPeriodo(blocoZero);

  // Verificações após bloco zero
  assert.equal(estado.plano.length, 1, "Plano deve ter 1 bloco (comp-time)");
  assert.equal(estado.plano[0].dias, 0);
  assert.equal(env.periodosDeFeriasEscolhidos().length, 0, "Nenhum período de férias reais foi consumido");
  assert.equal(env.getTelaAtiva(), "tela-decisao", "Deve avançar para tela de decisão após bloco 0");

  const decisaoResumo = env.getOrCreateElement("decisao-resumo").innerHTML;
  assert.ok(decisaoResumo.includes("Folgas banco/TRE"), "Resumo deve mencionar as folgas de banco/TRE");

  const botoesDecisao = env.getOrCreateElement("decisao-botoes").children;
  assert.ok(botoesDecisao.length > 0, "Deve haver botões de opções de férias");

  // 2. Servidor escolhe o 1º período de férias reais (15 dias)
  estado.dias = 15;
  estado.etapa = 2;
  const restr1 = env.restricoesDoPlano();
  assert.equal(restr1.fracionado, true);
  assert.ok(restr1.diasBloqueados.size > 0, "Dias do bloco 0 devem estar bloqueados");

  const sugestoes15_1 = Motor.calcular("pmrp", null, 15, "corridas", restr1);
  assert.ok(sugestoes15_1.length > 0, "Deve encontrar sugestões de 15 dias sem colidir com bloco 0");
  const ferias1 = sugestoes15_1[0];

  env.escolherPeriodo(ferias1);

  // Verificações após 1º período de férias
  assert.equal(estado.plano.length, 2, "Plano deve ter 2 blocos (comp-time + férias 1)");
  assert.equal(env.periodosDeFeriasEscolhidos().length, 1, "Exatamente 1 período de férias reais consumido");
  assert.equal(env.getTelaAtiva(), "tela-decisao", "Ainda resta 1 período de férias, deve voltar para tela-decisao");

  const decisaoResumo2 = env.getOrCreateElement("decisao-resumo").innerHTML;
  assert.ok(decisaoResumo2.includes("Folgas banco/TRE"), "Resumo deve exibir o bloco de folgas");
  assert.ok(decisaoResumo2.includes("1º período de férias"), "Resumo deve exibir o 1º período de férias");

  // 3. Servidor escolhe o 2º período de férias reais (15 dias restantes)
  estado.dias = 15;
  estado.etapa = 3;
  const restr2 = env.restricoesDoPlano();
  assert.ok(restr2.diasBloqueados.size > restr1.diasBloqueados.size, "Dias bloqueados devem acumular bloco 0 e férias 1");

  const sugestoes15_2 = Motor.calcular("pmrp", null, 15, "corridas", restr2);
  assert.ok(sugestoes15_2.length > 0, "Deve encontrar sugestões para 2º período de 15 dias");
  const ferias2 = sugestoes15_2[0];

  env.escolherPeriodo(ferias2);

  // Verificações após 2º período de férias
  assert.equal(estado.plano.length, 3, "Plano deve conter 3 blocos (comp-time + 15d + 15d)");
  assert.equal(env.periodosDeFeriasEscolhidos().length, 2, "2 períodos de férias reais foram consumidos");
  assert.equal(env.getTelaAtiva(), "tela-final", "Com 2 períodos e 30 dias de férias, deve ir para tela-final");

  // Resumo final
  const totalDias = estado.plano.reduce((s, p) => s + p.dias, 0);
  assert.equal(totalDias, 30, "Total de dias de férias usados deve ser exatamente 30");

  const sobraEl = env.getOrCreateElement("final-sobra").innerHTML;
  assert.ok(sobraEl.includes("Você planejou todos os 30 dias de férias"), "Mensagem deve confirmar plano completo de 30 dias");
});

test("Prevenção de colisão (diasBloqueados) através de comp-time + período 1 + período 2", () => {
  const env = createMockEnvironment();
  const estado = env.getEstado();

  estado.ente = "pmrp";
  estado.cidade = "Ribeirão Preto";
  estado.usaEspeciais = true;
  estado.diasEspeciais = 2;
  estado.dias = 0;

  // 1. Bloco de folgas comp-time
  const sugs0 = Motor.calcular("pmrp", null, 0, "corridas", { diasEspeciaisDisponiveis: 2 });
  const b0 = sugs0[0];
  env.escolherPeriodo(b0);

  // 2. Primeiro período de férias de 15 dias
  estado.dias = 15;
  const restr1 = env.restricoesDoPlano();
  const sugs1 = Motor.calcular("pmrp", null, 15, "corridas", restr1);
  const b1 = sugs1[0];
  env.escolherPeriodo(b1);

  // 3. Segundo período de férias de 15 dias
  estado.dias = 15;
  const restr2 = env.restricoesDoPlano();

  // Verifica que diasBloqueados contém todos os dias de b0 e de b1
  const H = Motor.helpers;
  for (let d = new Date(b0.blocoInicio); d <= b0.blocoFim; d = H.addDias(d, 1)) {
    assert.ok(restr2.diasBloqueados.has(H.iso(d)), `Dia ${H.iso(d)} do bloco comp-time deve estar bloqueado`);
  }
  for (let d = new Date(b1.blocoInicio); d <= b1.blocoFim; d = H.addDias(d, 1)) {
    assert.ok(restr2.diasBloqueados.has(H.iso(d)), `Dia ${H.iso(d)} do 1º período de férias deve estar bloqueado`);
  }

  // Calcula todas as opções para o 2º período
  const sugs2 = Motor.calcular("pmrp", null, 15, "corridas", restr2);
  assert.ok(sugs2.length > 0, "Deve haver opções válidas para o 2º período");

  // Nenhuma sugestão do 2º período pode tocar qualquer dia de b0 ou b1
  sugs2.forEach((sug) => {
    for (let d = new Date(sug.blocoInicio); d <= sug.blocoFim; d = H.addDias(d, 1)) {
      const dataIso = H.iso(d);
      assert.ok(!restr2.diasBloqueados.has(dataIso), `Sugestão de 2º período colide no dia ${dataIso}`);
    }
  });

  const b2 = sugs2[0];
  env.escolherPeriodo(b2);

  // Após adicionar b2, restricoesDoPlano deve agora bloquear os três blocos
  const restrFinal = env.restricoesDoPlano();
  for (let d = new Date(b2.blocoInicio); d <= b2.blocoFim; d = H.addDias(d, 1)) {
    assert.ok(restrFinal.diasBloqueados.has(H.iso(d)), `Dia ${H.iso(d)} do 2º período de férias deve estar bloqueado`);
  }
});
