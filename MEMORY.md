# Memória Persistente do Projeto — Férias Inteligente

Este arquivo registra o histórico permanente de auditorias, regras de negócio aprendidas, correções implementadas e diretrizes de arquitetura para orientação de sessões e modelos futuros.

---

## [2026-11-04 15:55] - Revisão e Correção Automática (/revisar)

### 🔍 Problemas Identificados & Causa Raiz

1. **Incongruência de Metadados em `js/dados.js` (`montarCalendarios`)**:
   - *Falha*: A função `montarCalendarios()` reconstruía o objeto `calendarios[ano].entes[enteId]` com uma lista fixa de propriedades (`id`, `nome`, `esfera`, `pagamento`, `abonadas`, etc.), omitindo `regrasInicio` que foi adicionada em `data/entes.json`.
   - *Causa Raiz*: Whitelist manual de propriedades em `js/dados.js` sem mapear `regrasInicio`. No motor (`js/motor.js`), a condição `enteObj && enteObj.regrasInicio` resultava em `undefined` no navegador (funcionava na USP somente pelo fallback `ehUsp === true`).

2. **Incongruência no Precache Offline do PWA (`sw.js`)**:
   - *Falha*: `js/pwa.js` é importado no final de `index.html` para registrar o Service Worker, mas não estava listado no array `PRECACHE` do `sw.js`.
   - *Causa Raiz*: Omissão do arquivo ao estruturar os assets do shell offline.

3. **Incompatibilidade Multiplataforma no Script de Validação (`package.json`)**:
   - *Falha*: O comando `"check": "agy-node --check js/*.js scripts/*.js"` falhava no Windows (`MODULE_NOT_FOUND`) porque cmd/powershell não expandem globs (`*.js`), e dependia do binário `agy-node` em vez do runner universal `node`.
   - *Causa Raiz*: Suposição de expansão de glob pelo shell (comum em bash, inexistente em cmd.exe).

4. **Lacuna de Testes em `escolherAno` e `montarCalendarios`**:
   - *Falha*: A função de virada de ano (`escolherAno`, regra de 1º de outubro) e a integridade de montagem de calendários não possuíam testes unitários automatizados.

5. **Lista de Arquivos do Sincronizador GitHub Desatualizada (`scripts/upload-github.js`)**:
   - *Falha*: `upload-github.js` não continha `js/pwa.js`, `MEMORY.md` nem novos utilitários.

---

### 🛠️ Correções Implementadas

1. **Propagação de `regrasInicio` em `js/dados.js`**:
   - Adicionado `regrasInicio: entes[id].regrasInicio || null` na montagem de cada ente em `montarCalendarios()`.
   - Exportadas as funções `montarCalendarios` e `escolherAno` tanto em `window` (quando em navegador) quanto em `module.exports` (quando em ambiente Node.js de teste).

2. **Atualização do Precache Offline (`sw.js`)**:
   - Incluído `"js/pwa.js"` no array `PRECACHE`.
   - Incrementado `CACHE_VERSION` para `"v6"` para garantir revalidação imediata do cache nos clientes.

3. **Criação do Verificador de Sintaxe Universal (`scripts/check-syntax.js`)**:
   - Criado script nativo em Node.js usando a API `vm.Script` para varrer recursivamente `js/`, `scripts/` e `test/`.
   - Atualizado `package.json` para `"check": "node scripts/check-syntax.js"` e `"test": "node --test test/**/*.test.js"`.
   - Atualizado `.github/workflows/ci.yml` para executar o script multiplataforma.

4. **Novos Testes Automatizados em `test/dados.test.js`**:
   - Teste de `escolherAno`: valida que antes de 1º de outubro (ex.: setembro) o app não libera o ano seguinte, e a partir de 1º de outubro o ano seguinte é liberado.
   - Teste de `montarCalendarios`: valida que `regrasInicio.proibirSexta` e `regrasInicio.proibirAntecedenciaFeriado` são devidamente propagados para `window.CALENDARIOS[ano].entes.usp`.

5. **Sincronização Abrangente (`scripts/upload-github.js`)**:
   - Incluídos `js/pwa.js`, `scripts/check-syntax.js` e `MEMORY.md` no array `ARQUIVOS`.

---

### 🧪 Validação

- **Sintaxe**: 17 arquivos JS verificados via `scripts/check-syntax.js` (0 erros).
- **Testes Unitários**: 23 testes executados com 100% de aprovação (0 falhas).
  - App exporta iniciar, trocarAno e resetar
  - App.trocarAno reseta estado completo e limpa DOM
  - atualizarAnoUI e trocarAno refletem ano no DOM
  - js/dados.js delega para App.trocarAno com fallback
  - js/dados.js escolherAno: transição de ano respeita 1º de outubro
  - js/dados.js montarCalendarios: preserva regrasInicio de entes.json
  - pmrp 30 dias corridas: totalDescanso >= 30
  - usp 15 dias abonadas: abonadas dentro das regras
  - limeira abonadas _duplo: somente quando fracionado é false
  - usp 5 dias: resultados válidos com diasFerias === 5
  - 0 dias de férias com banco de horas: semFerias: true e diasEspeciais.length > 0
  - usp ferias: nunca iniciam na sexta-feira nem nos 2 dias que antecedem feriados
  - pmrp: permite inícios em sexta-feira quando aplicável
  - Meeus Easter e feriados móveis 2027 e 2028
  - Moveis.entradasParaJSON: estrutura correta
  - Botão personalizado: HTML, listeners, comportamento e CSS
  - opcoesRestantes: 0 dias + fluxo multi-período + prevenção de colisão

---

### 🧠 Regras & Decisões Aprendidas (Para Próximos Chats)

1. **Configuração Orientada a Dados (`data/entes.json`)**:
   - Toda nova regra ou restrição legal de um órgão (ex.: `regrasInicio`, `abonadas`) deve ser declarada em `data/entes.json` e propagada em `js/dados.js:montarCalendarios()`.
   - O motor em `js/motor.js` deve sempre ler do `enteObj` montado a partir de `CALENDARIOS[ano].entes[enteId]`, mantendo fallback conservador apenas se o metadado não estiver definido.

2. **Regras Férias Web (USP / CLT art. 134, § 3º)**:
   - Servidores da USP nunca podem iniciar férias na sexta-feira nem nos 2 dias que antecedem feriados ou pontos facultativos.
   - Folgas de banco de horas / TRE puras (`diasFerias === 0`) são isentas dessa vedação de férias.

3. **Transição de Ano (1º de Outubro)**:
   - O ano Y só é liberado para exibição a partir de 1º/out do ano Y-1. Antes dessa data, mesmo que os dados do ano Y existam, o app prioriza o ano corrente para evitar exibição de projeções antes dos decretos oficiais.

4. **Multiplataforma (Windows + Linux)**:
   - Nunca utilizar wildcards (`*.js`) em chamadas CLI do `package.json` dependentes de shell. Use scripts Node dedicados (`scripts/check-syntax.js`).

---

## [2026-11-04 16:55] - Correção de Falha na CI e Desbloqueio do GitHub Pages

### 🔍 Problemas Identificados & Causa Raiz

1. **Falha na CI (Node 20)**:
   - *Falha*: A execução dos testes automatizados falhava no ambiente Node 20 com o erro: `Could not find '.../test/**/*.test.js'`.
   - *Causa Raiz*: No runner Ubuntu do GitHub Actions, o bash é executado sem `globstar` ativado, de forma que o padrão recursivo `**/*.test.js` não é expandido pelo shell. No Node 22 há resolução de globs embutida no CLI, mas no Node 20 a ausência de expansão causou a tentativa de carregar o arquivo com o literal `**`, quebrando a esteira com exit code 1.
   - *Impacto*: O repositório exibia badge de falha vermelha (❌), e o deploy do GitHub Pages foi impedido de prosseguir.

2. **Deploy Quebrado no GitHub Pages (`errored: Page build failed`)**:
   - *Falha*: O status da API do GitHub Pages retornou `Pages status: errored (Page build failed.)`.
   - *Causa Raiz*: Ausência do arquivo `.nojekyll` na raiz do repositório. Por padrão, o GitHub Pages aciona o parser do Jekyll para compilar o site. Na presença de arquivos markdown e diretórios especiais, o Jekyll falhou na compilação estática.
   - *Impacto*: O site publicado em `https://matheusdochapeu-hub.github.io/ferias-inteligente/` permaneceu estagnado na versão antiga (`v4`), onde as férias da USP ainda iniciavam em sextas-feiras.

3. **Spam de Commits Concorrentes no Sincronizador (`scripts/upload-github.js`)**:
   - *Falha*: O script subia todos os 21 arquivos sequencialmente criando 21 commits separados via API REST, cancelando deploys do Pages e estourando o limite de concorrência.
   - *Causa Raiz*: Ausência de verificação de hash Git local vs. remoto (`gitBlobSha`).

### 🛠️ Correções Implementadas

1. **Correção do Padrão de Testes na CI (`.github/workflows/ci.yml` & `package.json`)**:
   - Substituído `node --test test/**/*.test.js` por `node --test test/*.test.js`. Como todos os testes do projeto estão situados diretamente na raiz da pasta `test/`, o glob simples é expandido perfeitamente tanto no Node 20 quanto no Node 22 e no Windows.

2. **Criação de `.nojekyll` na Raiz**:
   - Adicionado o arquivo `.nojekyll` para desativar o mecanismo Jekyll no GitHub Pages, garantindo deploy estático imediato e livre de falhas de build.

3. **Deduplicação de Uploads via Hash Git (`scripts/upload-github.js`)**:
   - Implementado cálculo de SHA-1 idêntico ao Git (`blob <size>\0<bytes>`). O script agora verifica se o hash local coincide com o remoto e pula arquivos inalterados, enviando apenas arquivos que de fato sofreram modificação.

### 🧪 Validação

- Testes nativos executados: 23 testes passando localmente (Node 20 e 24+).
- Script de sintaxe: 17 arquivos validados sem nenhum erro de parsing.
- Verificação exaustiva de sextas-feiras: 0 sugestões de início em sextas-feiras para a USP em qualquer cidade ou modo.


---

## [2026-11-05 16:30] - Nova Identidade Visual e Ícones Modernos 3D (Lógica do App Maracaju)

### 🎨 Motivação & Solução
1. **Nova Identidade Visual 3D**:
   - Seguindo a lógica do app Maracaju, o cabeçalho agora utiliza uma marca estruturada (`.brand-wrapper`) com o logotipo moderno do app (`.brand-logo`) ao lado do título institucional, substituindo o emoji cru anterior.
   - Ícone concebido com metáfora 3D tátil de alto padrão (calendário moderno de mesa integrado a um cenário tropical ensolarado com mar turquesa, areia e guarda-sol listrado, em degradê azul real e oceano profundo).
2. **Pacote Completo de Ícones PWA**:
   - Gerados com interpolação de alta qualidade: `icon-512.png`, `icon-192.png`, `icon-maskable-512.png` (com safe margin para launchers circulares/adaptativos do Android), `apple-touch-icon.png` (180x180), `favicon.png` (64x64) e `favicon.ico` multi-resolução (16/32/48/64) na raiz.
   - Criado script de automação `scripts/generate-icons.ps1` usando PowerShell e `System.Drawing`.
3. **PWA & Cache**:
   - `sw.js` atualizado para a versão de cache `v7`, incluindo os novos assets de ícone no precache offline.
4. **Validação**:
   - 16 arquivos JS validados pelo verificador de sintaxe (0 erros).
   - 23 testes unitários nativos executados com 100% de aprovação.


---

## [2026-11-06 11:30] - Botão de Instalação PWA e Guia Ilustrado

### 📲 Motivação & Solução
1. **Botão "Instalar aplicativo" no Cabeçalho**:
   - Adicionado botão pill com degradê azul escuro/real (`#1565c0` / `#0d47a1`), ícone `📲` e microinteração de hover em `.header-actions`.
   - Se o usuário já estiver acessando em modo standalone (PWA instalado), o botão é automaticamente ocultado para não ocupar espaço.
2. **Suporte Nativo Android / Chromium e Guia iOS**:
   - Em navegadores com suporte a `beforeinstallprompt` (Chrome Android, Edge, etc.), aciona diretamente a caixa de diálogo nativa de instalação com 1 toque.
   - No iPhone/Safari ou navegadores sem prompt nativo, abre o modal acessível `#instalar-modal` com passo a passo ilustrado para iOS (Safari), Android e Computador.
3. **PWA & Cache**:
   - `sw.js` incrementado para `v8`.
4. **Validação & Testes**:
   - Criado `test/pwa.test.js` cobrindo presença no HTML, estilos CSS e listeners em `js/pwa.js`.
   - 17 arquivos JS validados pelo verificador de sintaxe (0 erros).
   - 26 testes unitários nativos executados com 100% de aprovação.

- **Garantia de Desaparecimento Pós-Instalação**:
  - Implementada media query CSS `@media all and (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui) { #btn-instalar-app, .header-actions { display: none !important; } }`, eliminando qualquer piscada visual ao abrir o app instalado.
  - Monitoramento contínuo em JavaScript (`ehStandalone()`, listener dinâmico de `matchMedia`, evento `appinstalled`, aceite no `beforeinstallprompt` e persistência em `localStorage`).
  - Adicionado botão *"Já instalei o app"* no rodapé do modal de instruções para usuários de iPhone/Safari poderem ocultar o botão manualmente caso desejem.
