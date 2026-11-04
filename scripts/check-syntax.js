"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const raiz = path.join(__dirname, "..");
const diretorios = ["js", "scripts", "test"];
let total = 0;
let erros = 0;

for (const dir of diretorios) {
  const dirPath = path.join(raiz, dir);
  if (!fs.existsSync(dirPath)) continue;

  const arquivos = fs.readdirSync(dirPath, { recursive: true });
  for (const arq of arquivos) {
    if (typeof arq !== "string" || !arq.endsWith(".js")) continue;
    // Pula vendor/ minificados se houver
    if (arq.includes("vendor")) continue;

    const fullPath = path.join(dirPath, arq);
    const relPath = path.relative(raiz, fullPath);
    try {
      const conteudo = fs.readFileSync(fullPath, "utf8");
      new vm.Script(conteudo, { filename: relPath });
      total++;
    } catch (err) {
      console.error(`❌ Erro de sintaxe em ${relPath}:`, err.message);
      erros++;
    }
  }
}

if (erros > 0) {
  console.error(`\nFalha: ${erros} erro(s) de sintaxe encontrado(s).`);
  process.exit(1);
} else {
  console.log(`✔ Sintaxe verificada com sucesso em ${total} arquivos JS.`);
}
