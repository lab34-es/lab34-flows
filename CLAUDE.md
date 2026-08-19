# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@lab34/flows` is a CLI + web UI for running E2E flows. A **flow** is a Markdown
document whose executable steps are ```` ```step ```` fenced blocks (YAML inside);
legacy `.yaml`/`.yml` flows with a `steps:` list still work. Steps call methods on
user-written **applications** (TypeScript, HTTP/MQTT/Postgres/Playwright), can
**mimic** dependencies with local HTTP servers, and carry **test** assertions.

## Commands

```bash
npm install              # root: CLI, API, helpers
npm run install:frontend # web UI deps (separate package tree)

npm run dev              # API on :3001 via tsx + nodemon (no build step)
npm run frontend         # web UI on :3000 (vite, proxies /api and /socket.io to :3001)
npm run dev:full         # both
npm run dev:prod         # build frontend + package, then run dist/api.js

npm run build            # tsc -p tsconfig.build.json + scripts/copy-assets.js
npm run typecheck        # tsc over src/ and tests/, no emit
npm run lint             # eslint (lint:fix to autofix)
npm test                 # jest
npm run test:coverage    # jest with the 80% gate
npm run coverage:badge   # refresh .github/badges/coverage.svg

npm run lint      --prefix frontend
npm run typecheck --prefix frontend
npm run build     --prefix frontend
```

Single test / single case:

```bash
npx jest tests/helpers/flows.test.ts
npx jest tests/helpers/flows.test.ts -t "parses frontmatter"
```

Running the tool itself (from source):

```bash
npx tsx src/cli.ts --file <flow.md> --env <environment> [--debug]
npx tsx src/cli.ts --server           # UI + API
npx tsx src/cli.ts --capabilities     # list applications and their methods
# --context <dir> overrides the default context directory (~/lab34-flows)
```

## The context directory

Everything the user owns lives outside the package, in the **context directory** —
`~/lab34-flows` by default, or `--context <dir>` (resolved by
`src/helpers/paths.ts`, which also handles the WSL Windows-home case):

```
<context>/
  flows/                      flow documents (.md, .yaml)
  applications/<name>/
    index.ts                  the application: exported methods
    mimic.ts                  optional: how this app behaves when mimicked
    env/<environment>.env     credentials per environment
  config/ai.json              AI provider + keys
  config/jira.json            Jira/Xray settings
  views.yaml                  folder views ("bases")
  tsconfig.json               generated, so editors type-check applications
  .examples-seeded            marker: examples are seeded once, never re-added
```

`src/defaults/` holds the bundled example applications and flows. They are
**templates executed in the user's context directory**, not modules of this
package: excluded from the TypeScript program and from coverage, copied verbatim
into `dist/defaults` by `scripts/copy-assets.js`, and seeded by
`helpers/bootstrap.ensureDefaults()` on every start (only once, and only for
paths that do not already exist).

## Architecture

**Entry points.** `src/cli.ts` (bin `lab34-flows`) runs a flow or starts the
server; `src/api.ts` → `src/api/index.ts` is the express 5 + Socket.IO server on
:3001, which also serves `frontend/dist` when it exists; `src/index.ts` is the
public `require('@lab34/flows')` surface that applications import (it re-exports
express itself so applications don't pull a second copy).

**Run pipeline.** `helpers/flows.start()` parses the document
(`helpers/markdownFlows.toFlow()` for Markdown, YAML otherwise), loads all
applications, then dispatches to `helpers/runner/v{flow.version||1}`. The runner
starts mimic servers (`helpers/mimicing` + `helpers/httpServer`), applies
Handlebars replacers, invokes the application method, runs assertions
(`helpers/runner/tester`) and reports each event through the **reporter**.

**Reporter.** `helpers/reporter.ts` is the single output channel: `server` is the
Socket.IO server for UI runs and a no-op emitter on the CLI, `cli: true` means a
person is at a terminal. Anything that needs to reach the user — progress, step
results, mid-flow input requests (`helpers/inputs`) — goes through it, never
straight to stdout or stdin. It also masks `password`/`token`/`secret`/
`authorization`-ish keys.

**Loading applications** (`helpers/appLoader.ts`) reaches into Node's module
internals on purpose, and the comment at the top of that file explains why:
application `.ts` files are **transpiled, not type-checked**, at run time (a type
error must never stop a flow from starting); `@lab34/flows` and `lab34-flows`
imports are answered with this process's own exports so applications share module
instances; and files are loaded through Node's `require` directly rather than the
ambient one so a test runner's transforms never apply to user code. `jest.config.js`
mirrors that alias in `moduleNameMapper`, so tests exercise `src/`, not a stale `dist/`.

**Applications** (`helpers/applications.ts`) export methods as arrays of
middlewares ending in the handler; `helpers/appDocs.ts` derives all documentation
from the JSDoc blocks in `index.ts` (`@param`, `@returns`, `@memory`, `@example`) —
there is no docs file to keep in sync.

**Bases / views** (`helpers/bases/`) implement Obsidian-Bases-style saved views over
flow frontmatter — `views.yaml` with `filters`, `formulas`, `properties`, `views`,
and a small expression language (`bases/expression.ts`) with the `note.` / `file.` /
`flow.` / `formula.` namespaces. This format deliberately mirrors Obsidian; keep it
that way rather than inventing new syntax.

**Other subsystems.** `helpers/ai/` is provider-agnostic (Ollama / Gemini /
Anthropic) and is used by `helpers/aiFlows.ts` to generate and edit flows, always
validating the result before it reaches the user. `helpers/jira/` maps a flow to an
Xray Test (`xray.testKey` in frontmatter) and its step blocks to test steps.
`latentApplications/mqtt.ts` holds long-lived connections across steps.

**Frontend** (`frontend/`, React 19 + Vite + Tailwind 4 + shadcn/ui, `@/` → `src/`)
talks to `services/api.ts` and `services/socket.ts`; execution state lives in
`context/ExecutionContext.tsx`. `website/` is a separate Astro docs site, not part
of the published package.

## Conventions that bite if ignored

- **Exact versions everywhere.** `.npmrc` sets `save-exact=true`; no `^`/`~` in any
  of the three package trees. Upgrades are deliberate commits.
- **CommonJS output, ESM syntax.** Authoring uses `import`, tsc emits CJS —
  consumers `require()` the package.
- **`noImplicitAny` is off on purpose** (JS→TS migration leftovers), as is
  `useUnknownInCatchVariables`. Type modules properly as you touch them rather than
  blanket-annotating `any`; don't turn the flags on globally in passing.
- **Coverage gate is 80%** on statements/branches/functions/lines, collected from
  *all* of `src/`, and CI fails below it. The number lives only in
  `jest.config.js`.
- **CI must pass**: lint, typecheck (package *and* frontend), coverage, `npm audit
  --audit-level=critical` in root/frontend/website, and a build that ends with
  `node dist/cli.js --help`.
- **Jest ignores everything under `.claude/`** (`testPathIgnorePatterns`), so a test
  run started from inside a `.claude/worktrees/<name>` worktree finds no suites at
  all. Run the suite from the main checkout.
- Tests silence the console via spies in `tests/jest.setup.ts` and stub
  `process.exit`; keep assertions on console calls working with that.
