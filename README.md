# 🏖️ Férias Inteligente — Servidores Públicos (2027)

App web (100% no navegador, **sem backend**) que sugere as **melhores datas para tirar férias**
e **emendar feriados** para:

- **Servidores da USP** — esfera estadual, em diversas cidades
- **Servidores da Prefeitura Municipal de Ribeirão Preto (PMRP)** — esfera municipal
- **Servidores da Prefeitura Municipal de Limeira** — esfera municipal

> **Regras de abonadas por ente.** USP e PMRP: 1 abonada por mês, teto de 6/ano. **Limeira**:
> teto de **12/ano** e é permitido **2 abonadas em um único mês** do ano (os demais meses: 1/mês);
> essa cota de "mês duplo" **não vale** quando as férias são fracionadas em mais de um período.
> As regras ficam em `data/entes.json` (campo `abonadas`) e são aplicadas por `js/motor.js`.

## Como funciona

O app tem um fluxo de **6 telas**: órgão → (cidade, se USP) → dias → preferência de mês →
resultados → (decisão de 2º período) → plano final.

1. **Órgão:** escolha PMRP ou USP — sem precisar se identificar.
2. **USP:** escolha a cidade da sua unidade (os feriados municipais mudam por cidade).
3. **Dias de férias:** 10, 15, 20 ou 30 dias — e **5 dias** (exclusivo da USP, que pode vender 10).
4. **Preferência de mês:** opcional, para que as sugestões comecem nos meses escolhidos.
5. **Resultados** em **quatro modos** (abas), listados da **melhor para a pior** opção,
   cada sugestão com um **minicalendário visual**:
   - **📅 Férias corridas:** só emendas de feriados municipais, estaduais e federais (e pontes).
   - **✨ Abonadas + doação:** usa abonadas (1 por mês) e doação de sangue para o máximo em casa.
   - **🗓️ Só abonadas:** usa abonadas, sem doação de sangue.
   - **🩸 Só doação de sangue:** usa apenas a folga de doação, sem abonadas.
6. **Decisão / plano final:** escolhido o 1º período, o app pode oferecer um 2º período
   (fracionamento) e monta o plano final com resumo e opção de **imprimir/PDF**.

   > As abonadas são do saldo anual do servidor (6/ano, 1 por mês) e a doação de sangue é
   > possível 1 vez a cada 3 meses. Cada sugestão é um cenário independente de quando tirar
   > as férias; o app respeita "1 abonada por mês" e "1 doação por janela" dentro de cada opção.
   > No modo abonadas, o app também cola uma abonada em cada ponta das férias quando isso
   > rende descanso real (fins de semana contam), favorecendo períodos que cruzam a virada
   > de mês (onde cabem 2 abonadas, 1 por mês).

Informações exibidas (apenas informativas):
- **Pagamento:** PMRP recebe no 1º dia útil; USP no 4º dia útil, com férias pagas adiantadas.
- **Quarta-feira de Cinzas:** na PMRP é meio período (emendável, não é feriado cheio); na USP
  as atividades são suspensas (tratada como feriado).

## Estrutura do projeto

```
index.html                        → página única com as 6 telas
css/estilo.css                    → estilos
js/motor.js                       → motor de cálculo (independente da interface)
js/app.js                         → controle de telas e renderização
js/dados.js                       → carregador: busca os JSON de feriados (fetch) e inicia o App
js/feedback.js                    → modal "Fale com o desenvolvedor" (Google Forms embutido)
js/pix.js                         → modal de doação via Pix (QR Code + copiar chave)
js/vendor/qrcode.min.js           → gerador de QR Code (davidshimjs/qrcodejs, MIT, vendorizado)
                                    (dias especiais / banco de horas / TRE vivem em js/motor.js + js/app.js)
js/contador.js                    → contador de acessos (painel visível só p/ o dev)
js/pwa.js                         → registra o service worker (instalação + offline)
sw.js                             → service worker: cache do app shell e dos feriados (offline)
manifest.webmanifest              → metadados de instalação do PWA (nome, ícones, cores)
icons/                            → ícones do PWA (192/512 + maskable), gerados por script
scripts/gerar-icones.js           → gera os PNG de ícone sem dependências externas
data/entes.json                   → metadados dos entes (nome, esfera, pagamento) — sem datas
data/feriados/nacionais-2027.json → feriados nacionais + facultativos nacionais
data/feriados/pmrp-2027.json      → feriados da PMRP (2027)
data/feriados/usp-2027.json       → feriados da USP, com as cidades (2027)
```

> **Dados em JSON puro.** Desde a refatoração, os feriados vivem em arquivos **JSON**
> (não mais num `.js` com objeto global). São dados limpos, seguros e geráveis por
> automação. O `js/dados.js` carrega esses arquivos via `fetch` e remonta em memória a
> estrutura que o motor consome.

## 🔧 Como atualizar os dados (feriados)

Edite o JSON do ente/ano correspondente em **`data/feriados/`**. O formato de cada dia é:

```json
{ "data": "2027-11-04", "nome": "Feriado municipal (São Carlos)", "tipo": "feriado" }
```

Tipos: `"feriado"` (dia cheio), `"facultativo"` (ponte/ponto facultativo), `"meio"` (meio período).

### Pontos facultativos de 2027 (confirmados)
Os pontos facultativos de 2027 estão **confirmados** e são usados nos cálculos de folga:
Carnaval (08-09/02), Quarta de Cinzas (10/02, meio período na PMRP/Limeira; feriado na USP),
**sexta pós-Corpus (28/05) — ponto facultativo para TODOS os entes/cidades** (em
`nacionaisFacultativos`; em Valinhos prevalece o feriado municipal dessa data), ponte de
N. Sra. Aparecida (11/10), pós-Dia do Servidor (29/10), Dia do Servidor (28/10, municípios),
ponte de Finados (01/11), véspera de Natal (24/12) e de Ano-Novo (31/12).

> Para **anos futuros** gerados automaticamente (ver automação anual), os facultativos
> continuam marcados como `"previsao"` até conferência humana — a confirmação acima vale
> especificamente para 2027.

### 🩸 Doação de sangue
No modo "Com abonadas + doação de sangue", a ferramenta sugere usar a folga de doação de
sangue (1 a cada 3 meses) para completar pontes quando a abonada do mês já foi usada.
Regra aplicada: no máximo 1 doação por janela de férias sugerida.

## 🚀 Como publicar online (grátis)

### Opção A — GitHub Pages (recomendado)
1. Crie uma conta em https://github.com (se ainda não tiver).
2. Crie um repositório novo (ex.: `ferias-inteligente`), público.
3. Envie estes arquivos para o repositório (botão **Add file → Upload files**, arraste
   `index.html`, as pastas `css/`, `js/`, `data/` e confirme com **Commit**).
4. No repositório, vá em **Settings → Pages**.
5. Em **Source**, escolha a branch `main` e a pasta `/ (root)`. Salve.
6. Em ~1 minuto o site estará no ar em:
   `https://SEU-USUARIO.github.io/ferias-inteligente/`

### Opção B — Netlify Drop (ainda mais simples)
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta inteira do projeto para a página.
3. Pronto — recebe um link público na hora.

### Opção C — rodar localmente (servidor)
Como os dados agora são carregados via `fetch`, **abrir o `index.html` por duplo clique
(`file://`) não funciona** (o navegador bloqueia o `fetch` local por CORS). Rode um
servidor local simples na pasta do projeto:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

(ou `npx serve`, se preferir Node.) No GitHub Pages / Netlify funciona normalmente, sem
nenhum passo extra.

## 🔄 Como atualizar o app (passo a passo)

Você NÃO precisa mexer no computador — tudo é feito pelo site do GitHub, no navegador.

### Caminho simples (editar um arquivo pelo GitHub)
1. Acesse o repositório: `https://github.com/matheusdochapeu-hub/ferias-inteligente`
2. Clique no arquivo que quer mudar — para feriados da PMRP, abra `data/feriados/pmrp-2027.json`.
3. Clique no ícone de **lápis** (✏️ "Edit this file"), no canto superior direito do arquivo.
4. Faça a alteração (ex.: trocar uma data, mudar `tipo`, adicionar um feriado).
5. Role até o fim e clique em **Commit changes** (botão verde).
6. Se o GitHub Pages já estiver ligado, o site atualiza sozinho em ~1 minuto.

### Exemplo prático: confirmar os pontos facultativos da PMRP 2027
Quando o Decreto Municipal de Ribeirão Preto para 2027 for publicado:
1. Abra `data/feriados/pmrp-2027.json` no GitHub e clique no lápis.
2. Localize a lista `facultativosLocais`.
3. Ajuste/acrescente as datas conforme o decreto, por exemplo:
   ```json
   { "data": "2027-10-28", "nome": "Dia do Servidor Público", "tipo": "facultativo" }
   ```
   e remova o sufixo "— previsão" dos que forem confirmados.
4. **Commit changes**. Pronto.

### Quando me chamar (Kiro)
Se preferir, é só me mandar o decreto/portaria que eu faço a atualização e o push para você.
Útil quando a mudança envolve lógica (não só dados).

## Expansão futura
A base de dados é desacoplada por **ente/ano** em arquivos JSON. Para adicionar um novo ano
(ex.: 2028), crie `data/feriados/nacionais-2028.json`, `data/feriados/pmrp-2028.json` e
`data/feriados/usp-2028.json` no mesmo formato, e aponte o `ANO` em `js/dados.js`. Para novos
órgãos (federal, outros municípios), acrescente uma chave em `data/entes.json` e crie os
arquivos de feriados correspondentes.

### 📅 Qual ano o app exibe (seleção automática)
O app **não** fica preso a um ano fixo. O `js/dados.js` lê `data/feriados/index.json` (lista
dos anos publicados) e escolhe qual exibir pela regra:

> Mostra o **maior ano publicado**, mas só **"vira" para o próximo ano a partir de 1º de
> outubro** do ano anterior — depois que os calendários/decretos do ano seguinte já saíram.

Exemplos: em qualquer data de jan–set/2027 o app mostra **2027**; a partir de **1º/out/2027**
(se 2028 já estiver publicado) passa a mostrar **2028**. Antes disso, nunca antecipa.

> Ressalva: a regra "não antecipar" pressupõe que o **ano corrente já esteja publicado** no
> índice. Se o índice listar apenas um ano futuro (ex.: só 2028, sem 2027), o app usa esse ano
> como fallback — ou seja, sempre há um ano válido para exibir. Na operação normal, o ano
> corrente estará sempre publicado.

### 🤖 Automação anual (GitHub Action) — duas rodadas (out + nov)
O workflow `.github/workflows/gerar-proximo-ano.yml` roda em **duas datas** (e sob demanda em
**Actions → Run workflow**), executa `scripts/gerar-ano.js` e **abre/atualiza um Pull Request**
com o rascunho dos feriados do **ano seguinte** (sempre `ano corrente + 1`, respeitando o
calendário):

- **1º de outubro** — 1ª geração (rascunho antecipado), para começar a conferir cedo.
- **1º de novembro** — 2ª rodada (reconferência): os cálculos determinísticos devem bater,
  **suas correções já feitas não são sobrescritas**, e o PR relembra o que ainda é "previsão".
  Inclui um passo de **conferência via BrasilAPI** dos feriados nacionais (apoio, não bloqueia).

O rascunho inclui:

- **Nacionais fixos** replicados; **móveis** calculados por fórmula (`js/moveis.js`);
  **municipais/estaduais fixos** replicados do ano anterior.
- **Facultativos/pontes** marcados com `"previsao": true` (e sufixo "— previsão") — dependem
  de Decreto (PMRP) / Portaria GR/CIRC (USP) e exigem **conferência humana**.
- Datas derivadas de móveis (ex.: sexta pós-Corpus) são deslocadas automaticamente, mas
  devem ser confirmadas.

Para rodar o gerador localmente:
```bash
node scripts/gerar-ano.js --alvo 2028 --molde 2027   # ou sem args: usa o maior ano existente
```

> ⚙️ **Pré-requisito único (uma vez):** em **Settings → Actions → General → Workflow
> permissions**, marque **"Allow GitHub Actions to create and approve pull requests"** —
> sem isso o Action não consegue abrir o PR.

### 📐 Feriados móveis calculados por fórmula (`js/moveis.js`)
Os feriados que dependem da Páscoa são calculados **localmente, sem API**, pelo algoritmo de
Meeus/Jones/Butcher (variação do método de Gauss). O módulo funciona no navegador e no
Node (é o que o robô da Parte 3 usará):

```js
const Moveis = require("./js/moveis.js"); // ou window.Moveis no navegador
Moveis.datasMoveisISO(2028);
// { pascoa:"2028-04-16", carnavalSegunda:"2028-02-28", carnavalTerca:"2028-02-29",
//   quartaDeCinzas:"2028-03-01", sextaFeiraSanta:"2028-04-14", corpusChristi:"2028-06-15" }

Moveis.entradasParaJSON(2028); // entradas já no formato dos JSON de feriados
```

Derivadas a partir do Domingo de Páscoa: Carnaval (−48/−47 dias), Quarta de Cinzas (−46),
Sexta-feira Santa (−2), Corpus Christi (+60). Validado contra as datas oficiais de 2024–2035
e contra os dados de 2027 já presentes no app.

## 📱 App instalável e offline (PWA)

O app é um **PWA** (Progressive Web App): dá para **instalá-lo** no celular ou no
computador e usá-lo **offline**, sem loja de aplicativos e sem custo.

- **Instalar no Android/desktop (Chrome/Edge):** abra o site e toque em
  *Instalar app* (ou menu ⋮ → *Instalar / Adicionar à tela inicial*).
- **Instalar no iPhone/iPad (Safari):** botão *Compartilhar* → *Adicionar à Tela de Início*.
- **Offline:** depois da primeira visita com internet, o app abre e calcula tudo
  mesmo sem conexão. Os feriados ficam em cache e são atualizados em segundo plano
  quando houver rede (estratégia *stale-while-revalidate*), respeitando a atualização
  anual dos dados.

**Como funciona (arquivos):**

- `manifest.webmanifest` — nome, ícones, cores e modo de exibição (`standalone`).
- `sw.js` — service worker: faz *precache* do app shell (HTML/CSS/JS/ícones) e serve
  os JSON de feriados com *stale-while-revalidate*. Ao publicar mudanças, **incremente
  `CACHE_VERSION`** no topo do `sw.js` para invalidar o cache antigo.
- `js/pwa.js` — registra o service worker (só sob `http`/`https`; via `file://` é ignorado).
- `icons/` — ícones PNG (192, 512 e *maskable* 512). Para regenerá-los:
  `node scripts/gerar-icones.js` (não precisa de nenhuma biblioteca).

> **Nota:** o service worker exige ser servido por `http(s)` — funciona no GitHub Pages
> ou num servidor local; abrindo o `index.html` direto por `file://` ele não é registrado
> (o app continua funcionando normalmente, só sem o modo offline).

> **Quer publicar na Play Store depois?** O caminho natural é empacotar este PWA como
> **TWA** (Trusted Web Activity) com o *Bubblewrap* — exige uma conta de desenvolvedor
> Google Play (taxa única). O PWA já cobre instalação + offline sem precisar da loja.

## 💬 Fale com o desenvolvedor (feedback)

Há um botão **"💬 Fale com o desenvolvedor"** na tela inicial e na tela final. Ele abre um
modal com um **Google Forms embutido** (sugestões, críticas, dúvidas). As respostas caem na
conta Google do responsável (aba *Respostas* do formulário, com opção de planilha). Não há
backend nem e-mail exposto no código.

- O formulário é carregado **sob demanda** (só quando o modal abre), via `<iframe>`.
- Se o `iframe` não carregar (política de incorporação, rede), o modal mostra um link de
  **fallback** para abrir o formulário em nova aba.
- Para trocar o formulário: altere `FORM_URL` em `js/feedback.js` e o `href` de fallback em
  `index.html` (procure por `forms.gle`).

## 🏦 Banco de horas / folgas TRE (dias especiais)

Alguns servidores têm **banco de horas** ou **folgas TRE** (dias trabalhados na eleição que
viram folga). Na tela de dias há um passo **opcional**: *"Você tem banco de horas / folgas
TRE e quer usar?"* → **Não** / **Sim**. Ao escolher **Sim**, aparece um **stepper (− / +)**
para informar **quantos** dias usar.

Regras aplicadas pelo motor (valem para **todos os entes**, atuais e futuros):
- **Prioridade:** os dias especiais são usados **antes** de abonadas e doação de sangue para
  furar dias úteis e emendar feriados/fins de semana.
- **Só dias úteis:** cada dia especial abate **um dia útil** (nunca sábado/domingo/feriado).
- **Posicionamento inteligente:** por excelência, o motor cola os dias especiais **colados a
  feriados/fins de semana** (que contam como descanso), maximizando a folga corrida.
- **Sem teto do app:** usa no máximo o saldo que o usuário informar.
- **Só quando ativado:** se o usuário não indicar, nada muda (feature desligada).
- **Modo "0 dias de férias":** com saldo informado, aparece o botão **"0 dias de férias (só
  folgas)"** — monta uma folga usando **somente** banco/TRE, **sem gastar férias** e sem
  consumir abonadas/doação.

No fracionamento (2º período), o saldo restante = informado − usados no 1º período.

## 💚 Doação via Pix

Botão **"☕ Me pague um café"** na tela inicial e na tela final. Abre um modal com:
- o **QR Code** do Pix, gerado **no próprio app** a partir do código "copia e cola"
  (biblioteca `qrcode.min.js`, MIT, vendorizada em `js/vendor/` — funciona offline, sem CDN);
- um botão **"Copiar chave Pix"** (com fallback para navegadores antigos).

A chave/código Pix fica em `PIX_COPIA_COLA` no topo de `js/pix.js` (payload EMV completo, com
CRC16 validado). Para trocar: substitua o código "copia e cola" lá. O QR e o botão não aparecem
na impressão/PDF.
