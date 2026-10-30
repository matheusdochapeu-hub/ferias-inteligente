const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Load data files
const entesDoc = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/entes.json"), "utf8"));
const nacionais2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/nacionais-2027.json"), "utf8"));
const pmrp2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/pmrp-2027.json"), "utf8"));
const usp2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/usp-2027.json"), "utf8"));
const limeira2027 = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/feriados/limeira-2027.json"), "utf8"));

// Construct CALENDARIOS matching js/dados.js:55-108
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

test("pmrp 30 dias corridas: returns suggestions with totalDescanso >= 30", () => {
  const sugestoes = Motor.calcular("pmrp", null, 30, "corridas");
  assert.ok(Array.isArray(sugestoes));
  assert.ok(sugestoes.length > 0);
  sugestoes.forEach((sug) => {
    assert.ok(sug.totalDescanso >= 30, `Expected totalDescanso >= 30, got ${sug.totalDescanso}`);
  });
});

test("usp 15 dias abonadas: returns suggestions with abonadas within rules", () => {
  const sugestoes = Motor.calcular("usp", "Ribeirão Preto", 15, "abonadas");
  assert.ok(Array.isArray(sugestoes));
  assert.ok(sugestoes.length > 0);
  sugestoes.forEach((sug) => {
    assert.ok(sug.abonadas.length <= 6, `Abonadas should not exceed annual cap of 6, got ${sug.abonadas.length}`);
    // Check max 1 abonada per month for USP
    const porMes = {};
    sug.abonadas.forEach((a) => {
      const ym = Motor.helpers.iso(a.dt).slice(0, 7);
      porMes[ym] = (porMes[ym] || 0) + 1;
    });
    for (const [ym, count] of Object.entries(porMes)) {
      assert.ok(count <= 1, `USP allows at most 1 abonada per month, found ${count} in ${ym}`);
    }
  });
});

test("limeira abonadas _duplo: _duplo only when fracionado is false", () => {
  const semFracionar = Motor.calcular("limeira", null, 15, "abonadas", { fracionado: false });
  assert.ok(semFracionar.length > 0);
  const temDuploSemFracionar = semFracionar.some((sug) =>
    sug.abonadas.some((a) => a._duplo === true)
  );
  assert.equal(temDuploSemFracionar, true, "Expected at least one suggestion with _duplo === true when fracionado is false");

  const fracionado = Motor.calcular("limeira", null, 15, "abonadas", { fracionado: true });
  assert.ok(fracionado.length > 0);
  const temDuploFracionado = fracionado.some((sug) =>
    sug.abonadas.some((a) => a._duplo === true)
  );
  assert.equal(temDuploFracionado, false, "Expected no suggestions with _duplo === true when fracionado is true");
});

test("usp 5 dias: returns valid results with diasFerias === 5", () => {
  const sugestoes = Motor.calcular("usp", "São Paulo", 5, "corridas");
  assert.ok(Array.isArray(sugestoes));
  assert.ok(sugestoes.length > 0);
  sugestoes.forEach((sug) => {
    assert.equal(sug.diasFerias, 5);
    assert.ok(sug.totalDescanso >= 5);
  });
});

test("0 dias de férias com banco de horas: returns suggestions with semFerias: true and diasEspeciais.length > 0", () => {
  const sugestoes = Motor.calcular("pmrp", null, 0, "corridas", { diasEspeciaisDisponiveis: 3 });
  assert.ok(Array.isArray(sugestoes));
  assert.ok(sugestoes.length > 0);
  sugestoes.forEach((sug) => {
    assert.equal(sug.semFerias, true);
    assert.equal(sug.diasFerias, 0);
    assert.ok(sug.diasEspeciais.length > 0);
  });
});
