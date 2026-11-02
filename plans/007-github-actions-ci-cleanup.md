# Plan 007: Add GitHub Actions CI Workflow, Remove Nested Directory, and Tighten Script CSP

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> Check that `.github/workflows/` exists.

## Status

- **Status**: DONE
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verification-baseline.md
- **Category**: dx
- **Planned at**: commit `ae1a4a6`, 2026-11-01

## Why this matters

1. **Continuous Integration (CI)**: While the repo now has automated tests (`node --test`) and syntax checking (`node --check`), there is no GitHub Actions workflow triggered on `push` or `pull_request`. Adding `.github/workflows/ci.yml` guarantees that future PRs and holiday updates are automatically tested on both Node 20 and Node 22.
2. **Directory Cleanup**: An accidental nested `.github/.github/workflows/gerar-proximo-ano.yml` exists in the repository tree, causing confusion and duplicate file tracking.
3. **CSP Hardening**: In `index.html:8`, `script-src` includes `'unsafe-inline'` even though all 8 scripts are loaded via external `<script src="...">` tags without inline code blocks. Removing `'unsafe-inline'` strengthens XSS defense.

## Current state

- Accidental duplicate folder: `.github/.github/`
- `index.html:8`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://abacus.jasoncameron.dev; frame-src https://docs.google.com https://forms.gle;" />
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `agy-node --test test/**/*.test.js` | all tests pass |
| Check | `agy-node --check js/*.js scripts/*.js` | exit 0 |

## Scope

**In scope**:
- `.github/workflows/ci.yml` (create)
- `.github/.github/` (delete duplicate directory)
- `index.html` (CSP update)

**Out of scope**:
- `.github/workflows/gerar-proximo-ano.yml` (keep unchanged)
- `js/motor.js`

## Steps

### Step 1: Remove nested duplicate folder `.github/.github/`

Delete `.github/.github` recursively so that only `.github/workflows/` remains under `.github/`.

**Verify**: `Test-Path ".github\.github"` → False.

### Step 2: Create `.github/workflows/ci.yml`

Create `.github/workflows/ci.yml`:
```yaml
name: CI — Testes e Verificação

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Testes Automatizados (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ["20", "22"]
    steps:
      - name: Checkout do código
        uses: actions/checkout@v4

      - name: Configurar Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Verificar sintaxe dos arquivos JS
        run: |
          node --check js/*.js scripts/*.js

      - name: Executar testes nativos
        run: |
          node --test test/**/*.test.js
```

**Verify**: Valid YAML, file exists at `.github/workflows/ci.yml`.

### Step 3: Tighten CSP in `index.html`

In `index.html`, replace:
`script-src 'self' 'unsafe-inline';`
with:
`script-src 'self';`

**Verify**: Check that all scripts continue to load cleanly and tests pass.

## Done criteria

- [x] `.github/.github/` no longer exists.
- [x] `.github/workflows/ci.yml` exists with Node 20 and 22 matrix running `--check` and `--test`.
- [x] `index.html` CSP `script-src` does not contain `'unsafe-inline'`.
- [x] `agy-node --test test/**/*.test.js` exits 0.
