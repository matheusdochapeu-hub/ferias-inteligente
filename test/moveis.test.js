const test = require("node:test");
const assert = require("node:assert/strict");
const Moveis = require("../js/moveis.js");

test("Meeus Easter and movable holidays 2027", () => {
  const m2027 = Moveis.datasMoveisISO(2027);
  assert.equal(m2027.pascoa, "2027-03-28");
  assert.equal(m2027.carnavalSegunda, "2027-02-08");
  assert.equal(m2027.carnavalTerca, "2027-02-09");
  assert.equal(m2027.quartaDeCinzas, "2027-02-10");
  assert.equal(m2027.sextaFeiraSanta, "2027-03-26");
  assert.equal(m2027.corpusChristi, "2027-05-27");
});

test("Meeus Easter and movable holidays 2028 (leap year)", () => {
  const m2028 = Moveis.datasMoveisISO(2028);
  assert.equal(m2028.pascoa, "2028-04-16");
  assert.equal(m2028.carnavalTerca, "2028-02-29");
  assert.equal(m2028.corpusChristi, "2028-06-15");
});

test("Moveis.entradasParaJSON returns valid array", () => {
  const res = Moveis.entradasParaJSON(2027);
  // Moveis.entradasParaJSON returns an object containing the holiday entries.
  // Collect the entries to validate each entry conforms to { data, nome, tipo }.
  const entradas = [
    ...res.nacionaisFacultativos,
    res.sextaFeiraSanta,
    res.corpusChristi,
    res.quartaDeCinzas
  ];
  assert.ok(Array.isArray(entradas));
  assert.ok(entradas.length >= 4);
  entradas.forEach(e => {
    assert.ok(e.data);
    assert.ok(e.nome);
    assert.ok(e.tipo);
  });
});
