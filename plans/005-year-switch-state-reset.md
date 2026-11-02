# Plan 005: Clean State Reset and Screen Refresh When Switching Years in Dynamic Selector

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> Check that `js/dados.js` contains `trocarAno` and `js/app.js` contains `_iniciado`.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md
- **Category**: bug
- **Planned at**: commit `ae1a4a6`, 2026-11-01

## Why this matters

When multiple years exist in `data/feriados/index.json`, `js/dados.js` renders a dynamic year selector (`.btn-seletor-ano`). Clicking a different year calls `trocarAno(novoAno)`, which loads the JSON data, updates `window.ANO_ATIVO` and invokes `window.App.iniciar()`.

However, `js/app.js:92` contains `if (_iniciado) return;`. As a result, `App.iniciar()` returns immediately without clearing `estado.plano`, without resetting `estado.dias`, and without re-rendering the active screen. The UI header updates to display the new year, but the screen continues showing suggestions calculated with the *previous* year's calendar. If the user selects a period, dates from different years are mixed into a single corrupted plan.

This plan introduces a clean `App.trocarAno(novoAno)` method that resets state, returns the user to `tela-orgao`, and updates all UI year labels.

## Current state

- `js/dados.js:175-189`:
```javascript
  function trocarAno(novoAno) {
    if (!_entesDocCache) return;
    carregarAno(novoAno, _entesDocCache)
      .then(({ ano, entesDoc, nacionais, pmrp, usp, limeira }) => {
        montarCalendarios(ano, entesDoc, nacionais, pmrp, usp, limeira);
        renderSeletorAno(_anosDisponiveis, ano);
        if (window.App && typeof window.App.iniciar === "function") {
          window.App.iniciar();
        }
      })
      .catch((err) => {
        console.error("[dados] erro ao trocar de ano:", err);
        mostrarErro(`Não foi possível carregar os dados de ${novoAno}.`);
      });
  }
```

- `js/app.js:91-94`:
```javascript
    atualizarAnoUI();
    if (_iniciado) return;
    _iniciado = true;
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `agy-node --test test/**/*.test.js` | all tests pass |
| Check | `agy-node --check js/dados.js js/app.js` | exit 0 |

## Scope

**In scope**:
- `js/app.js`
- `js/dados.js`
- `test/dados.test.js` (create)

**Out of scope**:
- `js/motor.js`
- `css/estilo.css`
- `data/**`

## Steps

### Step 1: Add `App.trocarAno` in `js/app.js`

1. In `js/app.js`, define function `trocarAno(novoAno)`:
   - Call `resetar()`.
   - Call `atualizarAnoUI()`.
   - Call `mostrarTela("tela-orgao")`.
   - Clear any rendered results in `#lista-resultados` and `#final-periodos`.
2. Export `trocarAno` on the returned `App` object: `return { iniciar, trocarAno, resetar };`.

**Verify**: `agy-node --check js/app.js` → exit 0.

### Step 2: Call `App.trocarAno` in `js/dados.js`

In `js/dados.js`, inside `trocarAno(novoAno)`:
Replace:
```javascript
        if (window.App && typeof window.App.iniciar === "function") {
          window.App.iniciar();
        }
```
with:
```javascript
        if (window.App && typeof window.App.trocarAno === "function") {
          window.App.trocarAno(ano);
        } else if (window.App && typeof window.App.iniciar === "function") {
          window.App.iniciar();
        }
```

**Verify**: `agy-node --check js/dados.js` → exit 0.

### Step 3: Write automated test in `test/dados.test.js`

Create `test/dados.test.js`:
1. Verify that `App.trocarAno` resets `estado` (clears `plano`, `dias`, `cidade`, `ente`).
2. Verify that `js/dados.js` delegates to `App.trocarAno`.
3. Verify that `atualizarAnoUI` reflects the new year in `#ano-subtitulo` and `#ano-plano`.

**Verify**: `agy-node --test test/dados.test.js` → all pass.

## Done criteria

- [x] `App.trocarAno` resets state, clears plan, and navigates to `tela-orgao`.
- [x] `js/dados.js` calls `App.trocarAno` upon year selection.
- [x] `agy-node --test test/**/*.test.js` exits 0.
- [x] `agy-node --check js/dados.js js/app.js` exits 0.
