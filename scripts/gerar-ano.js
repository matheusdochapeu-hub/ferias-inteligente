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
// garante uma data de calendário válida; corrige 29/02 em ano não bissexto -> 28/02
function validarData(dataISO, ano) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  // se o dia "transbordou" (ex.: 29/02 em ano comum vira 01/03), reancora para
  // o último dia válido do mês original.
  if (dt.getMonth() !== m - 1) {
    const ultimoDia = new Date(a, m, 0).getDate();
    return `${a}-${String(m).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  }
  return dataISO;
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
 * véspera/ponte colada a um feriado móvel) e, por isso, acompanham o móvel ao
 * mudar de ano. Detecta se a data do molde está a ±1..3 dias de um móvel e, se
 * sim, desloca pela MESMA diferença no ano-alvo, usando a âncora MAIS PRÓXIMA.
 *
 * IMPORTANTE: só se aplica a PONTES/FACULTATIVOS (tipo "facultativo"/"meio").
 * Um feriado FIXO de data civil (ex.: um feriado municipal que por acaso cai
 * perto do Corpus) NÃO deve se mover com a Páscoa — fixos são tratados por
 * trocaAno. Por isso esta função só é chamada para itens facultativos/meio. */
function ajustarDerivadaDeMovel(dataISO, anoMolde, anoAlvo) {
  const dm = Moveis.datasMoveis(anoMolde);
  const alvo = Moveis.datasMoveis(anoAlvo);
  const nomes = ["sextaFeiraSanta", "corpusChristi", "quartaDeCinzas", "carnavalSegunda", "carnavalTerca"];
  const [a, mes, d] = dataISO.split("-").map(Number);
  const dt = new Date(a, mes - 1, d);
  // escolhe a âncora móvel de MENOR distância (não a primeira da lista)
  let melhor = null;
  for (const k of nomes) {
    const diff = Math.round((dt - dm[k]) / 86400000);
    if (Math.abs(diff) >= 1 && Math.abs(diff) <= 3) {
      if (!melhor || Math.abs(diff) < Math.abs(melhor.diff)) melhor = { k, diff };
    }
  }
  if (!melhor) return null; // não é derivada de móvel
  const ref = alvo[melhor.k];
  const novo = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + melhor.diff);
  return Moveis._util.iso(novo);
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
    let nomeItem = item.nome;
    let ehMovel = false; // a data vem da fórmula (determinística)

    if (mapaMv[item.data]) {
      // a própria data é um feriado móvel -> usa a data móvel do ano-alvo
      dataNova = mapaMv[item.data];
      ehMovel = true;
    } else if (ehFacultativo(item.tipo)) {
      // pontes/facultativos podem "acompanhar" um móvel VIZINHO; se não for o
      // caso, é uma ponte de data fixa que pode cair em outro dia da semana no
      // ano-alvo — sinalizamos isso no nome para facilitar a conferência.
      const derivada = ajustarDerivadaDeMovel(item.data, ANO_MOLDE, ano);
      if (derivada) {
        dataNova = derivada;
      } else {
        dataNova = trocaAno(item.data, ano);
        if (!/dia da semana pode mudar/i.test(nomeItem)) {
          nomeItem = nomeItem + " (conferir: dia da semana pode mudar no ano)";
        }
      }
    } else {
      dataNova = trocaAno(item.data, ano); // feriado fixo
    }

    dataNova = validarData(dataNova, ano); // trata 29/02 em ano não bissexto
    const novo = { data: dataNova, nome: nomeItem, tipo: item.tipo };
    // Facultativos/meio viram PREVISÃO (dependem de decreto/portaria) — EXCETO
    // quando a data é um feriado móvel conhecido (ex.: Quarta de Cinzas), que é
    // 100% determinística por fórmula e não precisa de conferência humana.
    out.push(ehFacultativo(item.tipo) && !ehMovel ? comoPrevisao(novo) : novo);
  });
  return out;
}

/* ===================== geração ===================== */
console.log(`\nGerando rascunho de ${ANO_ALVO} a partir do molde ${ANO_MOLDE}...\n`);

/* Proteção contra "cascata de rascunho": se o ano-molde ainda contém itens
 * marcados como previsão (não revisados por um humano), gerar o próximo ano a
 * partir dele propagaria estimativas sobre estimativas. Recusamos — a menos que
 * o usuário force explicitamente com --permitir-molde-previsao. */
function moldeTemPrevisao(ano) {
  const arquivos = [`nacionais-${ano}.json`, `pmrp-${ano}.json`, `usp-${ano}.json`];
  // Detecta previsão por QUALQUER das duas convenções do projeto:
  //  - flag "previsao": true (gerada pelo próprio gerador), ou
  //  - sufixo "— previsão" no nome (usado nos arquivos-semente de 2027).
  const temPrevisao = (obj) => {
    const txt = JSON.stringify(obj);
    return txt.includes('"previsao":true') ||
           txt.includes('"previsao": true') ||
           /previs[ãa]o/i.test(txt);
  };
  return arquivos.some((a) => {
    try { return temPrevisao(lerJSON(a)); } catch (_) { return false; }
  });
}
if (!process.argv.includes("--permitir-molde-previsao") && moldeTemPrevisao(ANO_MOLDE)) {
  console.error(
    `✖ O ano-molde ${ANO_MOLDE} ainda tem itens "previsao": true (não revisados).\n` +
    `  Gerar a partir dele propagaria previsões sobre previsões. Primeiro revise e\n` +
    `  confirme os feriados de ${ANO_MOLDE} (removendo a flag "previsao"), ou rode com\n` +
    `  --molde <ano confirmado>. Para forçar mesmo assim: --permitir-molde-previsao.`
  );
  process.exit(1);
}

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

/* ---- Limeira ---- */
// Limeira é município de SP (mesma estrutura da PMRP). Feriado municipal próprio
// confirmado: 15/09 (N. Sra. das Dores / Aniversário). Fixos replicados; móveis
// recalculados; facultativos/pontes como previsão (confirmar com Decreto de Limeira).
const limeiraMolde = lerJSON(`limeira-${ANO_MOLDE}.json`);
const limeiraDoc = {
  ente: "limeira",
  ano: ANO_ALVO,
  _observacao: `Rascunho ${ANO_ALVO}: feriados fixos replicados; móveis recalculados; facultativos/pontes são PREVISÃO (confirmar com o Decreto Municipal de Limeira — site oficial bloqueia bot, conferir manualmente).`,
  feriadosLocais: replicarLista(limeiraMolde.feriadosLocais, mapaMv, ANO_ALVO),
  estaduais: replicarLista(limeiraMolde.estaduais, mapaMv, ANO_ALVO),
  facultativosLocais: replicarLista(limeiraMolde.facultativosLocais, mapaMv, ANO_ALVO)
};
escreverJSON(`limeira-${ANO_ALVO}.json`, limeiraDoc);

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

/* ---- índice de anos ---- */
// O app (js/dados.js) lê data/feriados/index.json para saber quais anos existem.
// Acrescentamos o ano-alvo (ordenado, sem duplicar). Sempre atualizamos o índice,
// mesmo que os JSON tenham sido pulados por já existirem, para garantir que o ano
// esteja listado.
(function atualizarIndice() {
  const caminho = path.join(DIR_FERIADOS, "index.json");
  let indice = { anos: [] };
  try { indice = JSON.parse(fs.readFileSync(caminho, "utf8")); } catch (_) { /* cria do zero */ }
  if (!Array.isArray(indice.anos)) indice.anos = [];
  if (!indice.anos.includes(ANO_ALVO)) {
    indice.anos.push(ANO_ALVO);
    indice.anos.sort((a, b) => a - b);
    indice._comentario = indice._comentario ||
      "Lista os anos com dados de feriados publicados. O app escolhe qual exibir (ver js/dados.js). Atualizado por scripts/gerar-ano.js.";
    fs.writeFileSync(caminho, JSON.stringify(indice, null, 2) + "\n", "utf8");
    console.log(`✓ índice atualizado: index.json agora inclui ${ANO_ALVO}`);
  } else {
    console.log(`• índice já continha ${ANO_ALVO}`);
  }
})();

console.log(`\nConcluído. Revise os arquivos de ${ANO_ALVO} (especialmente os marcados "previsao": true).`);
