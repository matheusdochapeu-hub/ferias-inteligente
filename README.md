# 🏖️ Férias Inteligente — Servidores Públicos (2027)

App web (100% no navegador, **sem backend**) que sugere as **melhores datas para tirar férias**
e **emendar feriados** para:

- **Servidores da Prefeitura Municipal de Ribeirão Preto (PMRP)** — esfera municipal
- **Servidores da USP** — esfera estadual, em diversas cidades

## Como funciona

1. **Tela inicial:** escolha o órgão (PMRP ou USP) — sem precisar se identificar.
2. **USP:** escolha a cidade da sua unidade (os feriados municipais mudam por cidade).
3. **Dias de férias:** 10, 15, 20 ou 30 dias.
4. **Resultados** em duas abas, listados da **melhor para a pior** opção:
   - **Férias corridas:** melhores datas emendando feriados municipais, estaduais e federais.
   - **Com abonadas + doação de sangue:** usa abonadas (máx. 6/ano, 1 por mês) e, quando a
     abonada do mês já foi usada, a folga por doação de sangue (1 a cada 3 meses) para
     maximizar os dias em casa.

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

## Expansão futura
A base de dados é desacoplada por ente/ano. Para adicionar um novo ano, crie
`data/feriados-2028.js` no mesmo formato e inclua no `index.html`. Para novos órgãos
(federal, outros municípios), acrescente uma chave em `entes` seguindo o modelo existente.
