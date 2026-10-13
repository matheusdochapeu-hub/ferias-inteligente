# 🏖️ Férias Inteligente — Servidores Públicos (2027)

App web (100% no navegador, **sem backend**) que sugere as **melhores datas para tirar férias**
e **emendar feriados** para:

- **Servidores da Prefeitura Municipal de Ribeirão Preto (PMRP)** — esfera municipal
- **Servidores da USP** — esfera estadual, em diversas cidades

## Como funciona

1. **Tela inicial:** escolha o órgão (PMRP ou USP) — sem precisar se identificar.
2. **USP:** escolha a cidade da sua unidade (os feriados municipais mudam por cidade).
3. **Dias de férias:** 10, 15, 20 ou 30 dias.
4. **Resultados** em **quatro modos** (botões), listados da **melhor para a pior** opção,
   cada sugestão com um **minicalendário visual**:
   - **📅 Férias corridas:** só emendas de feriados municipais, estaduais e federais (e pontes).
   - **✨ Abonadas + doação:** usa abonadas (1 por mês) e doação de sangue para o máximo em casa.
   - **🗓️ Só abonadas:** usa abonadas, sem doação de sangue.
   - **🩸 Só doação de sangue:** usa apenas a folga de doação, sem abonadas.

   > As abonadas são do saldo anual do servidor (6/ano, 1 por mês) e a doação de sangue é
   > possível 1 vez a cada 3 meses. Cada sugestão é um cenário independente de quando tirar
   > as férias; o app respeita "1 abonada por mês" e "1 doação por janela" dentro de cada opção.

Informações exibidas (apenas informativas):
- **Pagamento:** PMRP recebe no 1º dia útil; USP no 4º dia útil, com férias pagas adiantadas.
- **Quarta-feira de Cinzas (10/02/2027):** meio período (emendável, não é feriado cheio).

## Estrutura do projeto

```
index.html              → página única com as 4 telas
css/estilo.css          → estilos
js/motor.js             → motor de cálculo (independente da interface)
js/app.js               → controle de telas e renderização
data/feriados-2027.js   → base de feriados/pontos facultativos/pontes de 2027
```

## 🔧 Como atualizar os dados (feriados)

Edite **`data/feriados-2027.js`**. O formato é simples:

```js
{ data: "2027-11-04", nome: "Feriado municipal (São Carlos)", tipo: "feriado" }
```

Tipos: `"feriado"` (dia cheio), `"facultativo"` (ponte/ponto facultativo), `"meio"` (meio período).

### ⚠️ Pontos facultativos da PMRP 2027 (PREVISÃO)
O Decreto Municipal de Ribeirão Preto com o calendário oficial de 2027 costuma sair no
fim de outubro. Como ainda não foi publicado, os pontos facultativos de 2027 cadastrados
são uma **PREVISÃO** baseada no padrão recorrente da PMRP (decretos de 2025 e 2026):
Carnaval (08-09/02), Quarta de Cinzas (10/02, meio período), sexta pós-Corpus (28/05),
Dia do Servidor (28/10), véspera de Natal (24/12) e de Ano-Novo (31/12). Quando o decreto
oficial sair, confirme e ajuste `entes.pmrp.facultativosLocais` em `data/feriados-2027.js`.
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

### Opção C — abrir localmente
Basta dar duplo clique em `index.html`. Funciona offline no seu computador.

## 🔄 Como atualizar o app (passo a passo)

Você NÃO precisa mexer no computador — tudo é feito pelo site do GitHub, no navegador.

### Caminho simples (editar um arquivo pelo GitHub)
1. Acesse o repositório: `https://github.com/matheusdochapeu-hub/ferias-inteligente`
2. Clique no arquivo que quer mudar — para feriados, abra `data/feriados-2027.js`.
3. Clique no ícone de **lápis** (✏️ "Edit this file"), no canto superior direito do arquivo.
4. Faça a alteração (ex.: trocar uma data, mudar `tipo`, adicionar um feriado).
5. Role até o fim e clique em **Commit changes** (botão verde).
6. Se o GitHub Pages já estiver ligado, o site atualiza sozinho em ~1 minuto.

### Exemplo prático: confirmar os pontos facultativos da PMRP 2027
Quando o Decreto Municipal de Ribeirão Preto para 2027 for publicado:
1. Abra `data/feriados-2027.js` no GitHub e clique no lápis.
2. Localize o bloco `pmrp` → `facultativosLocais`.
3. Ajuste/accrescente as datas conforme o decreto, por exemplo:
   ```js
   { data: "2027-10-28", nome: "Dia do Servidor Público", tipo: "facultativo" }
   ```
   e remova o sufixo "— previsão" dos que forem confirmados.
4. **Commit changes**. Pronto.

### Quando me chamar (Kiro)
Se preferir, é só me mandar o decreto/portaria que eu faço a atualização e o push para você.
Útil quando a mudança envolve lógica (não só dados).

## Expansão futura
A base de dados é desacoplada por ente/ano. Para adicionar um novo ano, crie
`data/feriados-2028.js` no mesmo formato e inclua no `index.html`. Para novos órgãos
(federal, outros municípios), acrescente uma chave em `entes` seguindo o modelo existente.
