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
js/contador.js                    → contador de acessos (painel visível só p/ o dev)
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

### ⚠️ Pontos facultativos da PMRP 2027 (PREVISÃO)
O Decreto Municipal de Ribeirão Preto com o calendário oficial de 2027 costuma sair no
fim de outubro. Como ainda não foi publicado, os pontos facultativos de 2027 cadastrados
são uma **PREVISÃO** baseada no padrão recorrente da PMRP (decretos de 2025 e 2026):
Carnaval (08-09/02), Quarta de Cinzas (10/02, meio período), sexta pós-Corpus (28/05),
Dia do Servidor (28/10), véspera de Natal (24/12) e de Ano-Novo (31/12). Quando o decreto
oficial sair, confirme e ajuste `facultativosLocais` em `data/feriados/pmrp-2027.json`.
Os **feriados** (20/01, 19/06, Corpus Christi, nacionais e estadual) já são definitivos.

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
