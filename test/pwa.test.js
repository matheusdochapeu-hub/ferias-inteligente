const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("botão instalar app: presença no HTML e marcação correta", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

  // Deve conter o botão de instalação com id #btn-instalar-app
  assert.match(html, /id="btn-instalar-app"/);
  assert.match(html, /class="btn-instalar"/);
  assert.match(html, /Instalar aplicativo/i);

  // Deve conter o modal de guia de instalação #instalar-modal
  assert.match(html, /id="instalar-modal"/);
  assert.match(html, /data-fechar-instalar/);
  assert.match(html, /data-ja-instalado/);
  assert.match(html, /iPhone ou iPad/i);
  assert.match(html, /Android/i);
});

test("botão instalar app: estilos CSS definidos e regra de ocultamento standalone", () => {
  const css = fs.readFileSync(path.join(__dirname, "../css/estilo.css"), "utf8");

  assert.match(css, /\.btn-instalar\s*\{/);
  assert.match(css, /\.header-actions\s*\{/);
  assert.match(css, /\.instalar-caixa\s*\{/);
  assert.match(css, /\.instalar-bloco\s*\{/);
  
  // Regra de ouro: CSS media query deve ocultar automaticamente em modo standalone
  assert.match(css, /display-mode:\s*standalone/);
  assert.match(css, /#btn-instalar-app[\s\S]*?display:\s*none\s*!important/);
});

test("js/pwa.js: funções de gerenciamento de instalação e auto-ocultamento", () => {
  const pwaJs = fs.readFileSync(path.join(__dirname, "../js/pwa.js"), "utf8");

  assert.match(pwaJs, /beforeinstallprompt/);
  assert.match(pwaJs, /appinstalled/);
  assert.match(pwaJs, /abrirModalInstalar/);
  assert.match(pwaJs, /fecharModalInstalar/);
  assert.match(pwaJs, /ocultarBotaoInstalar/);
  assert.match(pwaJs, /marcarComoInstalado/);
  assert.match(pwaJs, /ehStandalone/);
  assert.match(pwaJs, /ferias_app_instalado/);
});
