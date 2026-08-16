# httpbin

Example application that talks to [httpbin.org](https://httpbin.org), the
classic HTTP request & response playground. Everything you send is echoed
back, so it is perfect to learn how flow steps, parameters and tests work
against a real HTTP API.

## What you can practice with it

- **Query parameters** (`get`) — echoed back under `body.args`.
- **JSON bodies** (`post`) — echoed back under `body.json`. Combine with
  replacers (`{{ randomEmail }}`, `{{ uuid }}`, …) to test with fresh random
  data on every run.
- **Status codes** (`status`) — ask for a `404` or a `503` and assert it in
  the step test.
- **Slow responses** (`delay`) — combine with `retry` to practice retry /
  timeout handling.

## Environment

| Variable | Description | Example |
|-|-|-|
| `BASE_URL` | Base URL of the httpbin instance | `https://httpbin.org` |

You can point it to a self-hosted httpbin (e.g. `docker run -p 80:80
kennethreitz/httpbin`) by changing `BASE_URL` in the environment file.
