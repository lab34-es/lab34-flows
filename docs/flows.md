# Flow files

Flows are YAML files stored in `<workspace>/flows`. Sub-folders are allowed
(they become categories in the GUI). Files may end in `.yaml` or `.yml`.

## Top-level structure

```yaml
title: Create an order            # optional; file name is used if missing
description: What this verifies   # optional, shown in the GUI and CLI
version: 1                        # optional runner version (default: 1)

latentApplications: []            # optional, see docs/testing.md#latent-applications

steps:
  - application: shop-api
    method: createOrder
    # ...
```

## Steps

Each step calls one **method** of one **application**
(see [Applications](applications.md)):

```yaml
steps:
  - application: shop-api          # required: application folder name
    method: createOrder            # required: exported method name
    slug: create                   # optional: custom step id (see below)
    description: Create the order  # optional: shown in reports and the GUI

    parameters:                    # passed to the method, after replacers run
      params:                      # by convention: URL path parameters
        orderId: 12
      query:                       # by convention: query-string parameters
        expand: items
      headers:                     # by convention: HTTP headers
        X-Request-Id: "{{ uuid }}"
      body:                        # by convention: request body
        customerId: "{{ randomInt0_100 }}"

    retry:                         # optional: retry when the method returns an
      times: 3                     # empty response (no headers/status/body)
      delay: 2000                  # milliseconds between attempts

    mimic: []                      # optional, see docs/mimicking.md
    test: {}                       # optional, see docs/testing.md
```

The `parameters` sub-keys (`params`, `query`, `headers`, `body`) are a
convention shared by the built-in `httpClient` and `validate` helpers — an
application method receives the whole `parameters` object and can define any
shape it wants.

## Step ids and slugs

Every step gets an id, used in logs, in the GUI, and to reference the step from
other steps:

- `slug: create` — you choose the id (recommended)
- otherwise the id is `<application>-<method>`, with `-<index>` appended when
  duplicated

## Referencing data between steps

All parameters go through the [replacers](replacers.md) engine before the step
runs. Besides random generators, the template context exposes the state of the
flow so far:

| Expression | Meaning |
|---|---|
| `{{ steps.<id>.request.body.customerId }}` | A value from a previous step's request (after replacement — the actual value that was sent) |
| `{{ steps.<id>.response.status }}` | A previous step's response status |
| `{{ steps.<id>.response.body.id }}` | A value from a previous step's response body |
| `{{ memory.<key> }}` | A value stored in flow memory by an application method |

```yaml
steps:
  - application: shop-api
    method: createOrder
    slug: create

  - application: shop-api
    method: getOrder
    description: Read back the order created above
    parameters:
      params:
        id: "{{ steps.create.response.body.orderId }}"
```

**Flow memory** is filled by application methods (the optional 4th element of
their return value) and accumulates across steps — useful when an application
wants to hand computed values to the rest of the flow. See
[Applications](applications.md#storing-values-in-flow-memory).

> Replaced values are inserted into JSON as strings when quoted. Most APIs and
> tests are tolerant of `"7"` vs `7` in URLs and paths; assert with `$expr:`
> when types matter (see [Testing](testing.md)).
>
> Replacers only run on `parameters` — **not** on `test` values. To assert
> against dynamic data, use `$expr:` expressions.

Replacement happens **once per step**, right before execution. On retries the
already-replaced values are reused, so a step keeps the same random data across
its attempts.

## A complete example

```yaml
title: Order lifecycle
description: Create an order, verify it, and check the blocked-customer error

steps:
  - application: shop-api
    method: createOrder
    slug: create
    parameters:
      body:
        customerId: "{{ randomInt0_100 }}"
        reference: "ORD-{{ randomString }}"
    test:
      status: 201
      body:
        status: created

  - application: shop-api
    method: getOrder
    slug: read
    parameters:
      params:
        id: "{{ steps.create.response.body.orderId }}"
    test:
      status: 200
      body:
        reference: "$expr: typeof value === 'string' && value.startsWith('ORD-')"

  - application: shop-api
    method: createOrder
    slug: blocked
    description: Customer 57 is always rejected
    parameters:
      body:
        customerId: 57
    test:
      status: 422
      body:
        error:
          code: CUSTOMER_BLOCKED
```

Runnable examples live in [`examples/workspace/flows`](../examples/workspace/flows).
