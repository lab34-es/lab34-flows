# __APPLICATION_NAME__

Describe here what this application is, who owns it, and anything worth
knowing before writing flows against it. This file is shown in the
application page of the UI.

## Structure

| File | What it is |
|-|-|
| `index.ts` | The methods flows call, and their documentation (JSDoc) |
| `env/local.env` | The `local` environment: `BASE_URL`, credentials, ids… |
| `README.md` | This file |

Every exported method of `index.ts` is documented with the JSDoc block above
it: `@param` for its input, `@returns` for its output, `@memory` for what it
reads from or writes to the flow memory, and `@example` for a ready-to-paste
step. That documentation is what the **Methods** section of the UI shows.

## Methods

| Method | Description |
|-|-|
| `helloWorld` | Offline greeting; writes `memory.greetedName` and `memory.lastGreeting` |
| `repeatGreeting` | Reads `memory.lastGreeting`, or answers `400` when nothing greeted yet |
| `ping` | `GET /get` against `BASE_URL`, an example HTTP call |

## A flow to try it

```step
application: __APPLICATION_NAME__
method: helloWorld
description: Greet a random name
parameters:
  body:
    name: "{{ randomName }}"
test:
  status: 200
```

```step
application: __APPLICATION_NAME__
method: repeatGreeting
description: The greeting is still in memory
test:
  status: 200
```

## Environment

| Variable | Description | Example |
|-|-|-|
| `BASE_URL` | Base URL every `httpClient` request is prefixed with | `https://httpbin.org` |
