---
title: Welcome to Markdown flows
description: A guided tour of Markdown-based flows, fully offline.
---

# Welcome to Markdown flows 👋

A flow is now just a **Markdown document**. You can write anything here —
headings, prose, lists, links, images — and turn any part of it into an
executable step by using a fenced code block tagged as `step`:

    ```step
    application: calculator
    method: add
    ...
    ```

When you press **Run**, the steps execute in order and the execution details
of each one appear right below its block — like a notebook.

## 1. A first step

Let's add two numbers. The step below calls the `add` method of the
`calculator` example application (no network needed):

```step
application: calculator
method: add
description: Add 2 + 40
parameters:
  body:
    a: 2
    b: 40
test:
  status: 200
  body:
    result: 42
```

The `test` section asserts the response: this flow only passes if the status
is `200` **and** `body.result` equals `42`.

## 2. Reusing results with memory

Applications can write to the flow **memory**. `calculator` stores every
result as `lastResult`, and any later step can read it with a Handlebars
template:

```step
application: calculator
method: multiply
description: Multiply the previous result by 2, using memory
parameters:
  body:
    a: "{{ memory.lastResult }}"
    b: 2
test:
  status: 200
  body:
    result: 84
```

## 3. Testing failure scenarios

Good E2E tests also cover the unhappy paths. `divide` returns a `400` with an
error body when dividing by zero — and we can assert exactly that:

```step
application: calculator
method: divide
description: Dividing by zero must fail with a DIVISION_BY_ZERO error
parameters:
  body:
    a: 1
    b: 0
test:
  status: 400
  body:
    error:
      code: DIVISION_BY_ZERO
```

## Where to go next

- Open **02 · HTTP basics** to test a real HTTP API (httpbin.org).
- Open **03 · Posts and memory** for a CRUD-style API example.
- Click any application in the sidebar to read its docs: methods, input
  parameters, outputs and memory usage.

By the way: regular code blocks are *not* steps — this one is just
documentation:

```js
// Nothing to execute here, it's only prose with syntax highlighting
console.log('Hello flows!');
```
