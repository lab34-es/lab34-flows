# calculator

A fully **offline** example application. No network, no credentials — ideal as a
first contact with flows and to try the tool on a plane. ✈️

It demonstrates three core concepts:

1. **Methods with parameters** — every method takes `body.a` and `body.b`.
2. **Flow memory** — each successful operation writes its result to
   `memory.lastResult`, so the next step can reuse it:

   ```yaml
   parameters:
     body:
       a: "{{ memory.lastResult }}"
       b: 2
   ```

3. **Testing failure scenarios** — `divide` returns a `400` with a
   `DIVISION_BY_ZERO` error body when `b` is `0`, which you can assert from a
   step test.

## Environment

| Variable | Description | Default |
|-|-|-|
| `PRECISION` | Number of decimals results are rounded to | `4` |

## Methods

| Method | Description |
|-|-|
| `add` | Adds two numbers (a + b) |
| `multiply` | Multiplies two numbers (a * b) |
| `divide` | Divides two numbers (a / b), 400 on division by zero |

See the **Methods** section in the UI (or `docs.json`) for the full input /
output / memory reference of each method.
