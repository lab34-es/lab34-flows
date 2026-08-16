# Applications

Applications are the core extension point of Lab34 Flows: small Node.js modules
that teach the tool how to talk to *your* systems. Each application lives in its
own folder inside the workspace:

```
<workspace>/applications/<name>/
├── index.js      # required: the methods flows can call
├── mimic.js      # optional: local impersonation (see docs/mimicking.md)
└── env/
    ├── staging.env
    └── production.env
```

The folder name is the application name used in flows
(`application: <name>`).

## Anatomy of index.js

```js
// Import the running tool. This resolves automatically to the installed
// @lab34/flows package - no NODE_PATH setup required.
const { applications, httpClient, validate } = require('lab34-flows');
const { handler } = applications;

module.exports.getOrder = handler([
  // 1. Description - shown in the GUI, --capabilities, and given to the AI
  'Fetch an order by id (GET /orders/:id)',

  // 2. Zero or more validators (optional)
  validate.params({
    type: 'object',
    properties: { id: { type: ['string', 'number'] } },
    required: ['id']
  }),

  // 3. The executor - always the last element
  (ctx, parameters, flow) => {
    const { params, headers } = parameters || {};
    return httpClient.get(ctx, `/orders/${params.id}`, { headers });
  }
], 'getOrder'); // the method name, as flows will call it
```

`handler([description, ...validators, executor], 'methodName')` wraps the
pieces into a self-describing method: the GUI and the AI ask it to describe
itself, and the runner executes it.

## The executor

```js
(ctx, parameters, flow) => [headers, status, body, memory?]
```

| Argument | Contents |
|---|---|
| `ctx.name` | Application name |
| `ctx.path` | Absolute path of the application folder |
| `ctx.env` | Parsed variables of the selected environment file |
| `ctx.reporter` | The active reporter (CLI output / GUI socket) |
| `parameters` | The step's `parameters` after replacers ran |
| `flow` | The whole flow state (steps so far, memory, execution info) |

The executor must return (or resolve to) an array:
`[headers, status, body]` — exactly what the `httpClient` helper returns, so
plain HTTP methods can simply `return httpClient.get(...)`.

### Storing values in flow memory

Return a 4th element to merge values into `flow.memory`, available to later
steps as `{{ memory.<key> }}`:

```js
async (ctx, parameters) => {
  const [headers, status, body] = await httpClient.post(ctx, '/orders', {
    body: parameters.body
  });
  return [headers, status, body, { createdOrderId: body.id }];
}
```

## Validation and fallbacks

The `validate` helpers check `parameters.body`, `parameters.query`,
`parameters.params` and `parameters.headers` against a JSON Schema (AJV), and
can **fill in missing values** through `fallbacks` — this is what lets flows
stay minimal while methods stay robust:

```js
validate.body({
  type: 'object',
  properties: {
    title:  { type: 'string' },
    userId: { type: ['string', 'number'] }
  },
  required: ['title', 'userId'],
  fallbacks: {
    // first fallback that produces a value wins
    title: [
      { type: 'memory',   key: 'lastTitle' },                          // from flow memory
      { type: 'replacer', method: 'values', key: 'randomString' }      // a replacer value
    ],
    userId: [
      { type: 'replacer', method: 'oneOf', values: [1, 2, 3] },        // random pick
      { type: 'static',   value: 1 }                                   // fixed value
    ]
  }
})
```

Fallback types:

| Type | Fields | Produces |
|---|---|---|
| `memory` | `key` | `flow.memory[key]` |
| `replacer` | `method: 'values'`, `key` | A [replacer value](replacers.md), e.g. `randomEmail` |
| `replacer` | `method: 'oneOf'`, `values` | A random element of `values` |
| `replacer` | `method: 'function'`, `value` | The result of calling `value()` |
| `static` | `value` | The value as-is |

Any fallback can also define `transform: (value) => ...` to post-process the
chosen value.

## The httpClient helper

```js
httpClient.get(ctx, '/orders', opts)
httpClient.post(ctx, '/orders', opts)
httpClient.put(ctx, '/orders/1', opts)
httpClient.patch(ctx, '/orders/1', opts)
httpClient.del(ctx, '/orders/1', opts)
```

- URLs are built as `ctx.env.BASE_URL + path`.
- `opts` accepts axios options: `headers`, `params` (query string), `body` or
  `data` (objects are JSON-encoded automatically), `timeout`, ...
- `opts.skipCertCheck: true` disables TLS verification for that request (self-signed
  certificates in test environments).
- Convenience headers from the environment:
  - `X_API_KEY=...` → sent as `x-api-key`
  - `HTTP_BASIC_AUTH=user:pass` → sent as `Authorization: Basic <base64>`
- HTTP errors (4xx/5xx) are **returned like any other response**, so flows can
  assert on them (`test: status: 404`). Only network-level failures (DNS,
  refused connections, timeouts) throw and mark the step as errored.

### Environment overrides per "case"

When `ctx.case` is set, variables suffixed with `_<case>` take precedence:
with `ctx.case = 'dev'`, `BASE_URL_dev` overrides `BASE_URL`. This allows one
env file to serve variants of the same environment.

## Other helpers available from `require('lab34-flows')`

| Helper | Purpose |
|---|---|
| `httpClient` | HTTP requests with reporting (above) |
| `validate` | JSON-schema validation + fallbacks (above) |
| `replacer` | The template engine: `values()`, `oneOf()`, `json()`, `barcode()`, ... |
| `httpServer` | Local Express servers for [mimicking](mimicking.md) |
| `pgClient` | PostgreSQL queries configured via env variables (see [Environments](environments.md#postgresql)) |
| `playwright` | Browser automation (see [Playwright](playwright.md)) |
| `mimicFiles` | Load canned mimic responses from files |
| `express` | The express instance used by the tool |

## A complete example

See [`examples/workspace/applications/jsonplaceholder/index.js`](../examples/workspace/applications/jsonplaceholder/index.js)
for a working application with validation, fallbacks and memory — and
[`examples/workspace/applications/billing`](../examples/workspace/applications/billing)
for one with a mimic.
