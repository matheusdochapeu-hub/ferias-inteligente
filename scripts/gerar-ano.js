#!/usr/bin/env node
/* =============================================================================
 * GERADOR DO RASCUNHO DE FERIADOS DO PRÓXIMO ANO (parte 3 da automação anual)
 * -----------------------------------------------------------------------------
 * Lê os JSON de um ano-molde (data/feriados/{ente}-{molde}.json) e produz os
 * JSON do ano-alvo (molde + 1, por padrão), aplicando estas regras:
 *
 *   NACIONAIS FIXOS      -> replicados com o novo ano (01/01, 21/04, 01/05,
 *                           07/09, 12/10, 02/11, 15/11, 20/11, 25/12).
 *   NACIONAIS MÓVEIS     -> recalculados por fórmula (js/moveis.js):
 *                           Sexta-feira Santa, Carnaval; Corpus/Cinzas por ente.
 *   FIXOS MUNICIPAIS/EST. -> replicados com o novo ano (a data fixa não muda;
 *                           o dia da semana se recalcula sozinho ao usar a data).
 *   FACULTATIVOS/PONTES   -> replicados, porém marcados como PREVISÃO (sufixo no
 *                           nome + "previsao": true), pois dependem de decreto/
 *                           portaria que só sai no fim do ano -> conferência
 *                           humana obrigatória.
 *   MÓVEIS por ente       -> Corpus Christi (feriado) e Quarta de Cinzas (USP:
 *                           feriado; PMRP: meio período) recalculados.
 *
 * NÃO sobrescreve arquivos que já existam (a menos de --force), para não apagar
 * dados já confirmados por um humano.
 *
 * Uso:
 *   node scripts/gerar-ano.js [--alvo 2028] [--molde 2027] [--force]
 * ===========================================================================*/
"use strict";

const fs = require("fs");
const path = require("path");
const Moveis = require(path.join(__dirname, "..", "js", "moveis.js"));

const RAIZ = path.join(__dirname, "..");
const DIR_FERIADOS = path.join(RAIZ, "data", "feriados");

/* ---------- argumentos ---------- */
function arg(nome, padrao) {
  const i = process.argv.indexOf("--" + nome);
  if (i === -1) return padrao;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
const FORCE = process.argv.includes("--force");
const ANO_MOLDE = Number(arg("molde", detectarUltimoAno()));
const ANO_ALVO = Number(arg("alvo", ANO_MOLDE + 1));

/* Descobre o maior ano para o qual já existe nacionais-{ano}.json. */
function detectarUltimoAno() {
  const anos = fs.readdirSync(DIR_FERIADOS)
    .map((f) => (f.match(/^nacionais-(\d{4})\.json$/) || [])[1])
    .filter(Boolean)
    .map(Number);
  if (!anos.length) throw new Error("Nenhum nacionais-{ano}.json encontrado em data/feriados/");
  return Math.max(...anos);
}

/* ---------- helpers ---------- */
function lerJSON(arquivo) {
  return JSON.parse(fs.readFileSync(path.join(DIR_FERIADOS, arquivo), "utf8"));
}
function escreverJSON(arquivo, obj) {
  const dest = path.join(DIR_FERIADOS, arquivo);
  if (fs.existsSync(dest) && !FORCE) {
    console.log(`• pulado (já existe): ${arquivo}  [use --force para sobrescrever]`);
    return false;
  }
  fs.writeFileSync(dest, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log(`✓ gerado: ${arquivo}`);
  return true;
}
// troca o ano de uma data "AAAA-MM-DD" mantendo mês/dia
function trocaAno(dataISO, ano) {
  return `${ano}-${dataISO.slice(5)}`;
}
// marca um item como previsão (sufixo no nome + flag)
function comoPrevisao(item) {
  const nome = /previs[ãa]o/i.test(item.nome) ? item.nome : item.nome + " — previsão";
  return { data: item.data, nome, tipo: item.tipo, previsao: true };
}
const ehFixoReplicavel = (tipo) => tipo === "feriado"; // feriados fixos replicam
const ehFacultativo = (tipo) => tipo === "facultativo" || tipo === "meio";

/* Mapa das datas móveis do MOLDE -> datas móveis do ALVO (mesmo "papel").
 * Permite recalcular QUALQUER feriado móvel onde quer que ele apareça (nacional,
 * estadual, municipal ou dentro de uma cidade), em vez de só nos lugares fixos. */
function mapaMoveis(anoMolde, anoAlvo) {
  const m = Moveis.datasMoveisISO(anoMolde);
  const a = Moveis.datasMoveisISO(anoAlvo);
  const mapa = {};
  ["sextaFeiraSanta", "corpusChristi", "quartaDeCinzas", "carnavalSegunda", "carnavalTerca"].forEach((k) => {
    mapa[m[k]] = a[k];
  });
  return mapa;
}

/* Datas que são "derivadas" de um móvel por proximidade (ex.: sexta pós-Corpus,
 * véspera/ponte colada a um feriado móvel). Detecta se a data do molde está a
 * ±1 dia de um móvel e, se sim, desloca pela MESMA diferença no ano-alvo. */
function ajustarDerivadaDeMovel(dataISO, anoMolde, mapaMv, anoAlvo) {
  const dm = Moveis.datasMoveis(anoMolde);
  const alvo = Moveis.datasMoveis(anoAlvo);
  const nomes = ["sextaFeiraSanta", "corpusChristi", "quartaDeCinzas", "carnavalSegunda", "carnavalTerca"];
  const [a, mes, d] = dataISO.split("-").map(Number);
  const dt = new Date(a, mes - 1, d);
  for (const k of nomes) {
    const ref = dm[k];
    const diff = Math.round((dt - ref) / 86400000);
    if (Math.abs(diff) >= 1 && Math.abs(diff) <= 3) {
      // é uma data colada a um móvel -> aplica o mesmo deslocamento no alvo
      const novo = new Date(alvo[k].getFullYear(), alvo[k].getMonth(), alvo[k].getDate() + diff);
      return Moveis._util.iso(novo);
    }
  }
  return null; // não é derivada de móvel
}

/* Replica uma lista do molde para o alvo, tratando móveis de forma genérica:
 *   - data == um móvel do molde          -> usa a data móvel correspondente do alvo
 *   - data colada (±1..3) a um móvel      -> desloca pela mesma diferença (previsão)
 *   - feriado fixo                        -> replica trocando o ano
 *   - facultativo/meio                    -> replica (marcado como previsão) */
function replicarLista(lista, mapaMv, ano) {
  const out = [];
  (lista || []).forEach((item) => {
    let dataNova;
    if (mapaMv[item.data]) {
      dataNova = mapaMv[item.data]; // é exatamente um feriado móvel
    } else {
      const derivada = ajustarDerivadaDeMovel(item.data, ANO_MOLDE, mapaMv, ano);
      dataNova = derivada || trocaAno(item.data, ano);
    }
    const novo = { data: dataNova, nome: item.nome, tipo: item.tipo };
    out.push(ehFacultativo(item.tipo) ? comoPrevisao(novo) : novo);
  });
  return out;
}

/* ===================== geração ===================== */
console.log(`\nGerando rascunho de ${ANO_ALVO} a partir do molde ${ANO_MOLDE}...\n`);

const mapaMv = mapaMoveis(ANO_MOLDE, ANO_ALVO);
const mv = Moveis.datasMoveisISO(ANO_ALVO); // datas móveis do ano-alvo

/* ---- nacionais ---- */
const nacMolde = lerJSON(`nacionais-${ANO_MOLDE}.json`);
const nacionais = (nacMolde.nacionais || []).map((it) => {
  // Sexta-feira Santa é o único nacional móvel da lista "nacionais"
  if (mapaMv[it.data]) {
    return { data: mapaMv[it.data], nome: it.nome, tipo: "feriado" };
  }
  return { data: trocaAno(it.data, ANO_ALVO), nome: it.nome, tipo: it.tipo };
});
// facultativos nacionais: Carnaval (móvel, recalculado) + os demais como previsão
const carnaval = [
  { data: mv.carnavalSegunda, nome: "Carnaval (ponto facultativo)", tipo: "facultativo", previsao: true },
  { data: mv.carnavalTerca,   nome: "Carnaval (ponto facultativo)", tipo: "facultativo", previsao: true }
];
const outrosFacNac = (nacMolde.nacionaisFacultativos || [])
  .filter((it) => !mapaMv[it.data] && !/carnaval/i.test(it.nome))
  .map((it) => comoPrevisao({ data: trocaAno(it.data, ANO_ALVO), nome: it.nome, tipo: it.tipo }));
const nacionalDoc = {
  ano: ANO_ALVO,
  quartaDeCinzas: mv.quartaDeCinzas,
  _gerado: `Rascunho gerado automaticamente a partir de ${ANO_MOLDE}. Facultativos/pontes marcados como previsão: confira o decreto/portaria oficial.`,
  nacionais,
  nacionaisFacultativos: carnaval.concat(outrosFacNac)
};
escreverJSON(`nacionais-${ANO_ALVO}.json`, nacionalDoc);

/* ---- PMRP ---- */
// A lista facultativosLocais da PMRP já contém Corpus (feriado) e Quarta de
// Cinzas (tipo "meio"); replicarLista recalcula ambos pela data móvel. Assim não
// é preciso reinseri-los manualmente.
const pmrpMolde = lerJSON(`pmrp-${ANO_MOLDE}.json`);
const pmrpDoc = {
  ente: "pmrp",
  ano: ANO_ALVO,
  _observacao: `Rascunho ${ANO_ALVO}: feriados fixos replicados; móveis recalculados; facultativos/pontes são PREVISÃO (confirmar com o Decreto Municipal).`,
  feriadosLocais: replicarLista(pmrpMolde.feriadosLocais, mapaMv, ANO_ALVO),
  estaduais: replicarLista(pmrpMolde.estaduais, mapaMv, ANO_ALVO),
  facultativosLocais: replicarLista(pmrpMolde.facultativosLocais, mapaMv, ANO_ALVO)
};
escreverJSON(`pmrp-${ANO_ALVO}.json`, pmrpDoc);

/* ---- USP ---- */
// estaduais da USP já contém Cinzas (feriado) e Corpus (feriado), ambos móveis;
// replicarLista recalcula pela data móvel. Rev. Constitucionalista é fixo.
const uspMolde = lerJSON(`usp-${ANO_MOLDE}.json`);
const uspEstaduais = replicarLista(uspMolde.estaduais, mapaMv, ANO_ALVO);
const uspCidades = {};
Object.keys(uspMolde.cidades || {}).forEach((cidade) => {
  uspCidades[cidade] = replicarLista(uspMolde.cidades[cidade], mapaMv, ANO_ALVO);
});
const uspDoc = {
  ente: "usp",
  ano: ANO_ALVO,
  _observacao: `Rascunho ${ANO_ALVO}: feriados fixos replicados; móveis recalculados; facultativos/pontes são PREVISÃO (confirmar com a portaria GR/CIRC).`,
  estaduais: uspEstaduais,
  facultativosGerais: replicarLista(uspMolde.facultativosGerais, mapaMv, ANO_ALVO),
  cidades: uspCidades
};
escreverJSON(`usp-${ANO_ALVO}.json`, uspDoc);

console.log(`\nConcluído. Revise os arquivos de ${ANO_ALVO} (especialmente os marcados "previsao": true).`);
