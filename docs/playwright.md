# Playwright (browser automation)

> Experimental

Flows can drive real browsers through [Playwright](https://playwright.dev).
Browser automations live in their own YAML files, and an application method
runs them with the `playwright` helper:

```js
// applications/my-website/index.js
const { applications, playwright } = require('lab34-flows');
const { handler } = applications;

module.exports.login = handler([
  'Log into the website with the credentials of the selected environment',
  (ctx, parameters, flow) => playwright.run(ctx, 'login.playwright.yaml', parameters, flow)
], 'login');
```

The YAML file path is resolved relative to the application folder.

## Automation file

```yaml
# Browser configuration
browserType: chromium      # chromium | firefox | webkit
device: Desktop Chrome     # any device from playwright.devices
keepOpen: false            # keep the browser open after the run (debugging)

launchOptions:
  headless: false
  ignoreHTTPSErrors: true
  timeout: 30000
  args: []

contextOptions:
  locale: en-US
  timezoneId: Europe/Madrid
  viewport:
    width: 1280
    height: 720

steps:
  - method: goto
    parameters:
      url: "https://example.com"
      waitUntil: networkidle
  - method: fill
    parameters:
      selector: "#username"
      value: "user123"
  - method: click
    parameters:
      selector: "#submit-button"
```

> With `keepOpen: true`, run the CLI with `--keep-alive` or the process will
> close the browser when the flow finishes.

## Available methods

| Method | Description | Main parameters |
|---|---|---|
| `goto` | Navigate to a URL | `url`, `waitUntil` (`load` \| `domcontentloaded` \| `networkidle`), `timeout` |
| `click` | Click an element | `selector`, `button`, `clickCount`, `delay`, `timeout` |
| `type` | Type text key by key | `selector`, `text`, `delay`, `timeout` |
| `fill` | Fill a form field | `selector`, `value`, `timeout` |
| `press` | Press a key | `selector`, `key`, `delay`, `timeout` |
| `hover` | Hover over an element | `selector`, `position`, `timeout` |
| `dragAndDrop` | Drag and drop | `source`, `target`, `force`, `timeout` |
| `selectOption` | Select a dropdown option | `selector`, `values`, `timeout` |
| `check` / `uncheck` | Toggle a checkbox | `selector`, `position`, `timeout` |
| `evaluate` | Run JavaScript in the page | `pageFunction`, `arg` |
| `keyboard` | Raw keyboard actions | `action`, `args` |
| `mouse` | Raw mouse actions | `action`, `args` |
| `waitForTimeout` | Wait a fixed time | `time` (ms) |
| `waitForSelector` | Wait for an element state | `selector`, `state` (`attached` \| `detached` \| `visible` \| `hidden`), `timeout` |
| `assertTitle` | Assert the page title | `title` |
| `screenshot` | Take a screenshot | `path`, `fullPage`, `omitBackground` |
| `waitForInput` | Pause until the user presses a key | — |
| `scrape` | Extract data from the page | map of `{ selector, output }` |

## Method examples

```yaml
- method: press
  parameters:
    selector: "#search-input"
    key: "Enter"

- method: selectOption
  parameters:
    selector: "#country-select"
    values: ["ES"]           # single string or array

- method: keyboard
  parameters:
    action: type
    args: ["Hello World", { delay: 100 }]

- method: mouse
  parameters:
    action: move
    args: [100, 200]         # x, y

- method: screenshot
  parameters:
    path: "screenshots/after-login.png"
    fullPage: true
```

### scrape

Extracts values from the page into the automation result. Each key defines a
selector and the output type (`string`, `number`, `boolean`, `date`):

```yaml
- method: scrape
  parameters:
    title:
      selector: "h1"
      output: string
    price:
      selector: ".price"
      output: number
    isAvailable:
      selector: ".stock-status"
      output: boolean
    publishDate:
      selector: ".publish-date"
      output: date
```
