# Getting started

## 1. Install

```bash
npm install -g @lab34/flows
```

This gives you the `lab34-flows` command, which includes both the CLI runner and
the web GUI.

> Applications written for the tool import it as `require('lab34-flows')`. The
> tool resolves that import automatically to the installed package — no
> `NODE_PATH` configuration is needed. (Set `NODE_PATH=$(npm root -g)` only if
> your application code requires *other* globally installed modules.)

## 2. Create a workspace

A **workspace** is a directory that holds everything the tool reads:

```
~/lab34-flows/                     # default workspace location
├── applications/                  # how to talk to your systems
│   └── my-api/
│       ├── index.js               # methods the flows can call
│       ├── mimic.js               # optional: local impersonation of this API
│       └── env/
│           ├── staging.env        # variables for the "staging" environment
│           └── production.env     # variables for the "production" environment
├── flows/                         # your flow definitions (YAML)
│   └── smoke/
│       └── login.yaml
└── config/
    └── ai.json                    # optional: AI provider configuration
```

By default the workspace lives at `~/lab34-flows`. Any command accepts
`--context <dir>` to use a different directory — handy for keeping workspaces
inside team repositories.

The quickest start is to copy the ready-made example workspace:

```bash
git clone https://github.com/lab34-es/lab34-flows.git
cp -r lab34-flows/examples/workspace/* ~/lab34-flows/
```

## 3. Define an application

Applications are small Node.js modules that expose **methods** — the actions your
flows can call. Create `~/lab34-flows/applications/my-api/index.js`:

```js
const { applications, httpClient, validate } = require('lab34-flows');
const { handler } = applications;

module.exports.getHealth = handler([
  'Check the API health endpoint',
  (ctx, parameters) => httpClient.get(ctx, '/health')
], 'getHealth');
```

And its environment file `~/lab34-flows/applications/my-api/env/staging.env`:

```bash
BASE_URL=https://staging.my-api.example.com
```

See [Applications](applications.md) for validation, fallbacks, memory, and the
full context object.

## 4. Write a flow

Create `~/lab34-flows/flows/smoke/health.yaml`:

```yaml
title: API health
description: The API answers and reports itself healthy

steps:
  - application: my-api
    method: getHealth
    test:
      status: 200
      body:
        status: ok
```

See [Flow files](flows.md) for the full format.

## 5. Run it

From the CLI:

```bash
lab34-flows --file flows/smoke/health.yaml --env staging
```

The CLI prints every request, response and test verdict, and exits with code `0`
when the flow passes and `1` when it fails — ready for CI.

Or from the GUI:

```bash
lab34-flows --server
# open http://localhost:3001
```

Pick the flow, choose an environment, press **Run flow** and watch each step
execute live. See [The GUI](gui.md).

## Next steps

- Make data dynamic with [Replacers](replacers.md)
- Chain steps and assert responses with [Testing](testing.md)
- Cut dependencies loose with [Mimicking](mimicking.md)
- Let AI draft flows for you with [AI flow generation](ai-flow-generation.md)
