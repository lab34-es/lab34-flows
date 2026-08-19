# __APPLICATION_NAME__

Describe here what this application is, who owns it, and anything worth
knowing before writing flows against it. This file is shown in the
application page of the UI.

## Structure

| File | What it is |
|-|-|
| `index.ts` | The methods flows call, and their documentation (JSDoc) |
| `env/<name>.env` | One file per environment a flow can run against |
| `README.md` | This file |

Neither the methods nor the environment variables are listed here: the UI
reads both from the application itself, so a copy in this file would only go
stale. Every exported method of `index.ts` is documented by the JSDoc block
above it — `@param` for its input, `@returns` for its output, `@memory` for
what it reads from or writes to the flow memory, and `@example` for a
ready-to-paste step — and that is what the **Methods** section of the UI
shows, alongside the environment files.

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
