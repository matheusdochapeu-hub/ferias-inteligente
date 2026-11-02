# Plan 006: Support Bank-of-Hours Comp Time Alongside Full Vacation Split (0 + 15 + 15)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> Check that `js/app.js` contains `escolherPeriodo` and `opcoesRestantes`.

## Status

- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-verification-baseline.md
- **Category**: correctness
- **Planned at**: commit `ae1a4a6`, 2026-11-01

## Why this matters

The app allows public servants to use bank of hours or TRE comp time by selecting **"0 dias de férias (só folgas)"**.

However, when a user selects "0 dias de férias" as their first block, `escolherPeriodo` transitions `estado.etapa` to `2`. If the user then plans a 15-day vacation period, the second call to `escolherPeriodo` sees `estado.etapa === 2` and strictly terminates to `tela-final`, because it treats any second selection as the final period.

This leaves 15 days of vacation unallocated (`TOTAL_FERIAS - totalDias = 15`) with no option to plan the second 15-day vacation period (e.g. 0 dias comp time + 15 dias férias + 15 dias férias). A 0-day comp-time block should not count as a vacation period against the 2-period split allowance.

## Current state

- In `js/app.js:655-666`:
```javascript
  function escolherPeriodo(sugestao) {
    estado.plano.push({ sugestao, modo: estado.modo, dias: estado.dias });

    const ehUsp = estado.ente === "usp";
    const opcoes = estado.etapa === 1 ? opcoesRestantes(estado.dias, ehUsp) : [];

    // se há opções de 2º período E ainda estamos na 1ª etapa, pergunta
    if (opcoes.length && estado.etapa === 1) {
      renderDecisao(opcoes);
      mostrarTela("tela-decisao");
    } else {
      renderFinal();
      mostrarTela("tela-final");
    }
  }
```

- In `js/app.js:122-127`:
```javascript
        if (alvo === "tela-dias" && estado.etapa === 2) {
          const ehUsp = estado.ente === "usp";
          const opcoes = opcoesRestantes(estado.plano[0].dias, ehUsp);
          renderDecisao(opcoes);
          alvo = "tela-decisao";
        }
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `agy-node --test test/**/*.test.js` | all tests pass |
| Check | `agy-node --check js/app.js` | exit 0 |

## Scope

**In scope**:
- `js/app.js`
- `test/motor.test.js` or `test/split.test.js` (add tests for 0 + 15 + 15 flow)

**Out of scope**:
- `js/motor.js` (calculation engine already handles `diasBloqueados` and `diasFerias = 0`)
- `css/estilo.css`

## Steps

### Step 1: Count vacation periods independently of 0-day comp-time blocks in `js/app.js`

1. Calculate how many *actual* vacation periods (`p.dias > 0`) have been chosen:
   ```javascript
   function periodosDeFeriasEscolhidos() {
     return estado.plano.filter((p) => p.dias > 0);
   }
   ```
2. When determining remaining options in `escolherPeriodo(sugestao)`:
   - If the newly added period was `dias === 0`, offer initial vacation options `opcoesRestantes(0, ehUsp)` (`[30, 20, 15, 10]` + 5 USP).
   - If the newly added period had `dias > 0` and this is the FIRST vacation period (`periodosDeFeriasEscolhidos().length === 1`), offer `opcoesRestantes(estado.dias, ehUsp)`.
   - If the user has already chosen 2 vacation periods, or if 30 days are fully planned (or 20 in USP when selling 10), proceed to `renderFinal()`.
3. In `renderDecisao(opcoes)`:
   Format the summary in `#decisao-resumo` listing all periods chosen so far (including comp time if present).
4. Update `alvo === "tela-dias"` back-button logic in `iniciar()` so that if the user returns to decision screen, it passes the options of the last vacation period.

**Verify**: `agy-node --check js/app.js` → exit 0.

### Step 2: Add test in `test/split.test.js`

Create `test/split.test.js`:
1. Test that `opcoesRestantes` allows planning after 0 days.
2. Test that a 0-day comp-time block followed by a 15-day vacation block correctly computes the remaining 15-day vacation options.
3. Test that collision detection (`diasBloqueados`) applies across all periods (comp time block + period 1 + period 2).

**Verify**: `agy-node --test test/split.test.js` → all pass.

## Done criteria

- [x] A user can select 0 dias de férias (só folgas), then 15 dias, and is offered the remaining 15 dias for a 3rd block.
- [x] Collision detection prevents overlap with all previously selected periods.
- [x] `agy-node --test test/**/*.test.js` exits 0.
- [x] `agy-node --check js/app.js` exits 0.
