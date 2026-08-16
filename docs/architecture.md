# Architecture

A map of the repository for contributors.

## Repository layout

```
├── src/
│   ├── cli.js                    # CLI entry point (bin: lab34-flows)
│   ├── index.js                  # library entry: helpers exposed to user applications
│   ├── api.js                    # standalone API launcher (used by nodemon dev)
│   ├── api/
│   │   ├── index.js              # express app + socket.io + static frontend serving
│   │   └── routes/               # /api/flows, /api/applications, /api/environment, /api/meta
│   ├── helpers/
│   │   ├── runner/
│   │   │   ├── v1.js             # the flow runner (versioned: flows may set version)
│   │   │   └── tester.js         # test evaluation (status, body, $expr, latent apps)
│   │   ├── applications.js       # workspace application discovery + handler()
│   │   ├── flows.js              # flow listing / reading / saving / AI generation
│   │   ├── paths.js              # workspace resolution (~/lab34-flows or --context)
│   │   ├── moduleAlias.js        # makes require('lab34-flows') resolve to this package
│   │   ├── httpClient.js         # HTTP helper for applications (axios + reporting)
│   │   ├── httpServer.js         # local express servers for mimicking
│   │   ├── mimicing.js           # mimic lifecycle during a flow
│   │   ├── replacer.js           # handlebars-based data generation
│   │   ├── validate.js           # AJV validation + fallbacks
│   │   ├── reporter.js           # CLI printing + socket.io event emission
│   │   ├── pgClient.js           # PostgreSQL helper
│   │   ├── playwright.js         # browser automation helper
│   │   └── io.js                 # socket.io server factory
│   └── latentApplications/
│       └── mqtt.js               # async-side-effect testing (MQTT)
├── frontend/                     # React + Joy UI + Vite GUI
│   └── src/
│       ├── components/           # FlowList, FlowViewer, ExecutionView, ...
│       ├── context/              # shared environment selection
│       └── services/             # api.js (axios), socket.js (socket.io-client)
├── docs/                         # this documentation
├── examples/workspace/           # runnable example workspace
└── tests/                        # jest unit tests
```

## How a flow executes (runner v1)

1. **Validate the environment** — it must exist in some application, and every
   application used by the flow must have its `<env>.env` file.
2. **Load application contexts** — each application gets `{ name, path, env }`.
3. **Load mimics** — every application referenced in `mimic` sections must have
   a `mimic.js`; they are required upfront.
4. **Start latent applications** (MQTT clients connect and subscribe).
5. **Build step ids** (`slug` or `application-method`).
6. For each step: start its mimics → run replacers on `parameters` → execute
   the method → store `request` / `response` on the step → evaluate `test` →
   handle retries → continue or abort.
7. Exit status: the CLI exits `0`/`1`; the API keeps streaming events.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/flows` | List flows of the workspace |
| POST | `/api/flows` | Create a flow file (`{name, folder?, content?}`) |
| GET | `/api/flows/user?path=...` | Read one flow (parsed + raw text) |
| PUT | `/api/flows/user` | Save a flow (`{path, content}`) |
| POST | `/api/flows/start` | Start an execution (`{value, environment}`) |
| POST | `/api/flows/create/ai` | Generate flow YAML from a prompt |
| GET | `/api/applications` | List applications (methods, env files) |
| GET | `/api/applications/:app` | One application |
| GET | `/api/applications/:app/envs[/:env[/raw]]` | Read env files |
| PUT | `/api/applications/:app/envs/:env/:key` | Update one variable |
| PUT | `/api/applications/:app/envs/:env/raw` | Replace an env file |
| GET | `/api/environment/all-possible` | Union of environment names |
| GET | `/api/meta` | Tool name, version, workspace directory |

One flow execution runs at a time; `POST /api/flows/start` answers `409` while
one is in progress.

## Socket events

The server pushes execution progress over Socket.IO as
`flowexecution:update` events:

```js
{
  id: '<execution uuid>',
  topic: 'execution' | 'diagram' | 'step',
  data: ...
}
```

| Topic | Payload |
|---|---|
| `execution` | `{ id, status: running|passed|error, times, error? }` |
| `diagram` | The whole flow (steps with ids) — sent once execution starts |
| `step` | `{ id, data: <step> }` — the step object incl. `execution`, `request`, `response`, `testReport` |

The GUI's `ExecutionView` renders directly from these events.

## Development setup

```bash
npm install
npm run install:frontend

npm run dev:full     # API (nodemon, :3001) + frontend (vite, :3000)
```

- The Vite dev server proxies `/api` to `:3001`; the frontend also talks to
  `:3001` directly (see `frontend/.env.development`).
- `npm run dev:prod` builds the frontend and serves everything from `:3001`,
  like the published package does.
- `npm test` runs the jest suite; `npm run lint` checks both backend and
  frontend sources.

## Publishing

`npm publish` triggers `prepublishOnly`, which installs the frontend
dependencies and builds it; the `files` field ships `src/`, `frontend/dist/`,
`docs/` and `examples/` — so `lab34-flows --server` works out of the box for
global installs.
