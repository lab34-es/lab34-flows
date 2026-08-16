# Examples

This folder contains a ready-to-use **workspace** — the directory layout Lab34 Flows
reads applications and flows from — so you can try the tool without writing anything first.

```
workspace/
├── applications/
│   ├── jsonplaceholder/        # HTTP application against a public API
│   │   ├── index.js            # methods: getPost, listPosts, createPost, getUser
│   │   └── env/staging.env     # BASE_URL for the "staging" environment
│   └── billing/                # fictional API, mimicked locally
│       ├── index.js            # methods: createInvoice, getInvoice
│       ├── mimic.js            # local impersonation server (port 4545)
│       └── env/local.env       # BASE_URL for the "local" environment
├── flows/
│   ├── quickstart/
│   │   ├── 01-first-request.yaml
│   │   ├── 02-random-data-and-expressions.yaml
│   │   └── 03-chained-steps.yaml
│   └── mimicking/
│       └── offline-billing-demo.yaml
└── config/
    └── ai.json.example         # copy to ai.json + add your key to enable AI generation
```

## Run the examples

From a checkout of this repository (or with `@lab34/flows` installed globally,
replacing `node src/cli.js` with `lab34-flows`):

```bash
# 1. Fully offline demo - the billing API is mimicked on localhost:4545
node src/cli.js --context examples/workspace --file flows/mimicking/offline-billing-demo.yaml --env local

# 2. Against a real public API (requires internet)
node src/cli.js --context examples/workspace --file flows/quickstart/01-first-request.yaml --env staging
node src/cli.js --context examples/workspace --file flows/quickstart/02-random-data-and-expressions.yaml --env staging
node src/cli.js --context examples/workspace --file flows/quickstart/03-chained-steps.yaml --env staging

# 3. Explore everything in the GUI instead
node src/cli.js --server --context examples/workspace
# then open http://localhost:3001
```

`--context` points the tool at a workspace directory. Without it, the default
workspace is `~/lab34-flows` — copy the contents of `workspace/` there if you
prefer running without the flag.

## What each example teaches

| Example | Concepts |
|---|---|
| `quickstart/01-first-request.yaml` | steps, parameters, status/body tests |
| `quickstart/02-random-data-and-expressions.yaml` | replacers, `$expr:` JavaScript assertions, validation fallbacks |
| `quickstart/03-chained-steps.yaml` | step slugs, `{{ steps.<slug>... }}` references, flow memory, asserting error statuses |
| `mimicking/offline-billing-demo.yaml` | mimicking dependencies, failure conditions, replacers in mimic responses |
| `applications/jsonplaceholder/index.js` | writing an application: handlers, validation, memory |
| `applications/billing/mimic.js` | writing a mimic with the httpServer helper |

Full documentation lives in [`../docs`](../docs).
