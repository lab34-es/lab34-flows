# Testing

Each step can declare a `test` block. When present, the runner verifies the
response and — if the test fails — marks the step (and the flow) as failed.
The CLI exits with code `1`; the GUI shows expected vs actual per assertion.

```yaml
steps:
  - application: shop-api
    method: getOrder
    parameters:
      params:
        id: 12
    test:
      status: 200
      body:
        id: 12
        status: confirmed
```

## What can be tested

### Status

```yaml
test:
  status: 200          # exact status
```

```yaml
test:
  status: [200, 201]   # any of these
```

### Body (deep subset match)

The expected body is compared **key by key, recursively** — extra keys in the
actual response are ignored, so you only assert what matters:

```yaml
test:
  body:
    status: created
    customer:
      id: 42
```

### JavaScript expressions (`$expr:`)

Any expected value can be a JavaScript expression. Prefix it with `$expr:`;
inside the expression, `value` is the actual value at that position:

```yaml
test:
  body:
    count: "$expr: value > 10"
    items: "$expr: Array.isArray(value) && value.length >= 3"
    user:
      age: "$expr: value >= 18 && value <= 65"
    createdAt: "$expr: new Date(value).getFullYear() === 2026"
```

The whole body can be an expression too:

```yaml
test:
  body: "$expr: Array.isArray(value) && value.length === 10"
```

Common patterns:

| Validation | Expression |
|---|---|
| Greater than | `$expr: value > 0` |
| In a range | `$expr: value >= 5 && value <= 10` |
| String contains | `$expr: typeof value === 'string' && value.includes('success')` |
| Non-empty array | `$expr: Array.isArray(value) && value.length > 0` |
| Property exists | `$expr: typeof value === 'object' && 'id' in value` |
| Date after | `$expr: new Date(value) > new Date('2026-01-01')` |

> Test values are **not** processed by [replacers](replacers.md) — use `$expr:`
> for dynamic assertions. Response **headers** are not asserted by the test
> engine currently; assert on status and body.

## Retrying failed tests

Useful for eventually-consistent systems — retry the step until the test
passes:

```yaml
test:
  status: 200
  body:
    status: processed
  retry:
    times: 5        # max retries after the first attempt
    delay: 2000     # milliseconds between attempts (default 1000)
```

The step re-executes with the **same** (already replaced) parameters, so random
values stay stable across attempts.

There is also a step-level `retry` (outside `test`) that retries when the
method returns an empty response — see [Flow files](flows.md#steps).

## Latent applications

Latent applications verify **asynchronous side effects**: things that should
happen *somewhere else* as a consequence of a step — currently MQTT messages.

Declare the clients at the top of the flow; they connect and subscribe before
the flow starts:

```yaml
latentApplications:
  - application: mqtt
    client: client1                # your id for this connection
    connection:
      host: broker.example.com
      protocol: mqtts              # default: mqtt
      key: /path/to/private.key    # optional TLS client credentials
      cert: /path/to/cert.crt
      ca: /path/to/ca.pem
    subscribe:
      - topic: devices/1/events
```

Then assert from any step that the expected message arrived:

```yaml
steps:
  - application: device-api
    method: switchOn
    test:
      latentApplications:
        - application: mqtt
          client: client1
          test:
            - topic: devices/1/events
              message:
                status: switched_to_on   # every listed key must match exactly
          retry:
            attempts: 5                  # validation attempts
            delay: 2                     # seconds between attempts
```

Notes:

- Messages are expected to be JSON; each `message` key you list must match the
  received payload exactly (top-level keys).
- Matching runs against **all messages received since the client connected**,
  so earlier steps' messages are visible to later assertions.
- `retry.delay` for latent tests is in **seconds** (unlike step retries).
