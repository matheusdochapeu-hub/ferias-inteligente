const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("botão personalizado: presença no HTML e marcação correta", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  
  // Deve conter o botão com o ID específico
  assert.match(html, /id="btn-dias-personalizado"/);
  
  // Deve conter o texto pedido pelo usuário
  assert.match(html, /escolher quantidade de dias personalizado/i);
  
  // Não deve possuir a classe btn-dias (para não disparar o fluxo de dias fixos das férias)
  const matchBtn = html.match(/<button[^>]*id="btn-dias-personalizado"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(matchBtn, "Botão #btn-dias-personalizado deve existir no HTML");
  assert.ok(!matchBtn[0].includes("btn-dias "), "Não deve conter a classe .btn-dias");
  assert.ok(matchBtn[0].includes("btn-personalizado"), "Deve conter a classe .btn-personalizado");
});

test("botão personalizado: listener e comportamento no js/app.js", () => {
  const appJs = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

  // Deve registrar o evento de clique no botão
  assert.match(appJs, /btnPersonalizado\.addEventListener\("click"/);
  
  // Deve direcionar para o bloco de especiais (banco de horas / folgas TRE)
  assert.match(appJs, /blocoEsp\.scrollIntoView/);
  
  // Deve ativar folgas automaticamente se ainda não ativadas
  assert.match(appJs, /espSim\.click\(\)/);
  
  // Deve ajustar o grid em renderInfoEnte para manter alinhamento em todos os órgãos
  assert.match(appJs, /btnPersonalizado\.style\.gridColumn\s*=\s*ehUsp\s*\?\s*""\s*:\s*"1\s*\/\s*-1"/);
});

test("botão personalizado: estilos CSS definidos", () => {
  const css = fs.readFileSync(path.join(__dirname, "../css/estilo.css"), "utf8");

  assert.match(css, /\.btn-personalizado\s*\{/);
  assert.match(css, /\.bloco-especiais-destaque\s*\{/);
});
