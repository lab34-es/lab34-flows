# Mimicking

Mimicking lets a flow **impersonate the dependencies** of the application under
test with tiny local HTTP servers. Point the dependency's `BASE_URL` at
localhost, and the mimic answers instead of the real system — so you can:

- run flows without every dependency being available,
- force failure scenarios that are hard to reproduce for real,
- develop flows completely offline.

A fully offline, runnable demo lives at
[`examples/workspace/flows/mimicking/offline-billing-demo.yaml`](../examples/workspace/flows/mimicking/offline-billing-demo.yaml).

## 1. Declare the mimic in the flow

Each step lists the applications that must be mimicked while it executes:

```yaml
steps:
  - application: shop-api
    method: createOrder
    mimic:
      - application: billing            # start applications/billing/mimic.js
        conditions:                     # optional, passed to the mimic
          failForCustomer:
            - "57"
```

Before the step runs, the runner starts the mimic of every listed application
(`applications/<name>/mimic.js` must exist). Servers stay up for the rest of
the flow.

## 2. Write the mimic

A mimic module exports `start(mimicConfig)` and `stop()`. The `httpServer`
helper handles the server plumbing and reporting:

```js
// applications/billing/mimic.js
const { httpServer } = require('lab34-flows');

const PORT = 4545;

// The server callback is registered once per port; keep the latest config in
// module state so per-step conditions apply.
let currentConfig = null;

module.exports.start = (mimicConfig) => {
  currentConfig = mimicConfig;

  return httpServer.start(mimicConfig, PORT, (req, res) => {
    const conditions = (currentConfig && currentConfig.conditions) || {};

    if (req.method === 'POST' && req.url.startsWith('/invoices')) {
      const blocked = (conditions.failForCustomer || []).map(String);

      if (blocked.includes(String(req.body.customerId))) {
        return res.json({
          error: { code: 'CUSTOMER_BLOCKED' }
        });
      }

      return res.json({
        invoiceId: '{{ uuid }}',          // replacers work in mimic responses
        status: 'created',
        customerId: req.body.customerId   // echo values straight from the request
      });
    }

    res.json({ ok: true });
  });
};

module.exports.stop = () => Promise.resolve();
```

`mimicConfig` contains everything declared in the step's `mimic` entry
(`application`, `conditions`, ...) plus `flow` (the running flow, including its
reporter).

## 3. Point the application at the mimic

The mimicked application's environment file for the environment you run with
should target the local port:

```bash
# applications/billing/env/local.env
BASE_URL=http://localhost:4545
```

## How responses work

- `res.json(data)` renders the response through the
  [replacers](replacers.md) engine. The **incoming request body** is part of
  the template context, so `{{ customerId }}` inserts `req.body.customerId`.
- `res.json` always answers with status `200`. For other status codes, use the
  raw response:

  ```js
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
  ```

- Every mimicked request and response is reported like any other traffic — in
  the CLI output and in the GUI execution view.

## Behavior notes

- One server is created per application + port; subsequent `start` calls reuse
  it. Keep per-step state (like `conditions`) in module scope, as in the
  example above.
- Mimic servers stay alive until the CLI process exits (the CLI exits
  automatically when the flow finishes) or the GUI server stops.
- `conditions` is a free-form object — define whatever your mimic understands
  (`failForCustomer`, `slowResponses`, `emptyLists`, ...). They make failure
  scenarios explicit and versioned in the flow file.
