<div align="center">

<img src="https://raw.githubusercontent.com/lab34-es/lab34-flows/master/docs/assets/logo.png" alt="Flows" width="96" height="96">

# Flows

**Trigger, understand and test E2E flows and behaviours.**

Write your end-to-end tests as Markdown documents, run them from a notebook-style
web UI or from CI, and let an AI write the boring parts for you.

[![npm version](https://img.shields.io/npm/v/@lab34/flows.svg)](https://www.npmjs.com/package/@lab34/flows)
[![npm downloads](https://img.shields.io/npm/dm/@lab34/flows.svg)](https://www.npmjs.com/package/@lab34/flows)
[![license](https://img.shields.io/npm/l/@lab34/flows.svg)](LICENSE)

</div>

<div align="center">

<img src="https://raw.githubusercontent.com/lab34-es/lab34-flows/master/docs/assets/ui-notebook.png" alt="A flow running in the web UI: prose, executable steps, and the request and response of each step below its block" width="900">

</div>

---

A flow is a **Markdown document**. Write whatever you want — headings, prose,
lists — and mark the executable parts as ```` ```step ```` blocks. Press *Run*
and the request, response, assertions and timings of every step appear right
below its block, like a notebook.

```bash
npm install -g @lab34/flows
lab34-flows --server        # http://localhost:3001
```

## Features

- **Flows are Markdown.** Documentation and test are the same file, so a flow
  explains itself and lives in your repository. (Legacy YAML flows keep working.)
- **Notebook-style UI.** Run a flow and read each step's execution details under
  its own code block — request, response, assertions, timings — streamed live.
- **Write flows with AI.** Describe the scenario and get a Markdown flow built
  from *your* applications, or hand an existing flow to the magic wand.
  Bring your own model: local **Ollama**, **Google Gemini** or **Anthropic (Claude)**.
- **Batteries included.** Example applications and flows are seeded on first run,
  and work offline.
- **Talks to everything.** HTTP APIs, MQTT, PostgreSQL databases, and web
  applications through Playwright.
- **Jira / Xray integration.** Link a flow to a Test issue and see its status in
  the UI.
- **Mimic dependencies.** Fake what a dependency answers so you can reproduce
  failure scenarios locally, without breaking anything for real.
- **Random data on every run**, with values frozen across retries so a retry
  tests exactly what the first attempt tested.
- **Assertions with real expressions**, not just equality.
- **Secrets stay on your machine**, in env files per application per environment.
- **CI-friendly**: the same flow you wrote in the UI runs headlessly from the CLI.

## Table of contents

- [Setup](#setup)
- [Quick start](#quick-start)
- [Writing a flow](#writing-a-flow)
- [The web UI](#the-web-ui)
  - [Managing files and folders](#managing-files-and-folders)
  - [Writing flows with AI](#writing-flows-with-ai)
- [Command line](#command-line)
- [Applications](#applications)
  - [Application docs (JSDoc)](#application-docs-jsdoc)
- [Assertions and tests](#assertions-and-tests)
- [Mimicking dependencies](#mimicking-dependencies)
- [Latent applications (MQTT)](#latent-applications-mqtt)
- [Browser automation (Playwright)](#browser-automation-playwright)
- [Replacers](#replacers)
- [Environments and secrets](#environments-and-secrets)
- [Where things live](#where-things-live)
- [Jira / Xray integration](#jira--xray-integration)
- [Bundled examples](#bundled-examples)
- [Development](#development)
- [License](#license)

## Setup

```bash
# Install globally
npm install -g @lab34/flows

# Extend NODE_PATH to npm's root, so your application scripts can access the library:
# On Linux / macOS:
export NODE_PATH=$(npm root -g)

# On Windows:
set NODE_PATH=%AppData%\npm\node_modules

# On NVM for Windows:
set NODE_PATH=%NVM_SYMLINK%\node_modules

# On NVM for Windows (PowerShell):
$env:NODE_PATH = "$env:NVM_SYMLINK\node_modules"
```

## Quick start

```bash
lab34-flows --server
```

Open <http://localhost:3001>. On the very first run your context directory
(`~/lab34-flows` by default) is seeded with example applications and flows.

1. **Pick an environment** in the sidebar footer. It decides which `env` file
   your applications are loaded with — the examples ship a `local` one.
2. **Open a flow.** Start with `examples/01-welcome.md`, which works fully
   offline.
3. **Press Run.** Steps execute in the order they appear in the document, and
   the details of each one appear right below its block.
4. **Write your own**, by hand or with the *Create using AI* switch.

To run the same flow headlessly, from CI:

```bash
lab34-flows --file flows/examples/01-welcome.md --env local
```

## Writing a flow

A flow is a Markdown document with an optional YAML frontmatter and any number
of ```` ```step ```` blocks. Regular code blocks (```` ```js ````, ```` ```bash ````)
are **not** executed — only `step` blocks are.

````markdown
---
title: Fraud detection
description: Fraud must be detected when the customer is flagged
---

# Fraud detection

Any prose you want. Then, an executable step:

```step
application: "accounting"
method: "getInvoice"
parameters:
  params:
    customerId: "{{ randomInt0_100 }}"
  query:
    from: "2023-01-01"
    to: "2023-01-31"
mimic:
  - application: "coinscrap"
    url: "/fraud-detection"
test:
  status: 404
  body:
    error:
      code: "ACCOUNTING_FRAUD_DETECTED"
```
````

Frontmatter carries the flow-level metadata — `title`, `description`, `version`,
`latentApplications`, `xray`. When there is no frontmatter title, the first
`#` heading is used.

Run it, and every step reports underneath its own block: the request that was
actually sent (with the random values already resolved), the response, the
assertions and the timings.

<div align="center">

<img src="https://raw.githubusercontent.com/lab34-es/lab34-flows/master/docs/assets/ui-notebook-step.png" alt="An executed step: the step block, then Passed, the timing, the response body and the assertions" width="900">

</div>

### Keys of a step block

| Key | What it does |
|-|-|
| `application` | The application to call. Must exist in your context folder. |
| `method` | The method of that application. |
| `description` | Free text shown next to the step in the UI. |
| `parameters` | What the method receives — usually `body`, `params`, `query`, `headers`. |
| `test` | The assertions for this step. See [Assertions and tests](#assertions-and-tests). |
| `mimic` | Fake the response of a dependency for this step. |
| `retry` | `{ times, delay }` — retry when the application answers **nothing** at all. |
| `testKey` | The Xray Test key this step maps to (informative). |

### The two retries

They cover different failures, and it is worth knowing which one you want:

- `retry` **on the step** fires only when the call comes back completely empty —
  no headers, no status, no body. It is for a dependency that is not up yet.
- `retry` **inside `test`** fires when the assertions do not pass, which is what
  you want for something that becomes true a moment later. Its `delay` defaults
  to 1000 ms.

In both cases the random values generated for the step are **frozen** on the
first attempt, so a retry sends exactly what the first attempt sent — a retry
never silently tests something else.

### Passing data between steps

Applications can write to the flow **memory**, and any later step reads it with
a Handlebars template:

````markdown
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
````

Which keys a method writes and reads is part of its documentation, through the
`@memory` JSDoc tag. Memory lives for one run of one flow: it starts empty every
time you press *Run*.

> Legacy YAML flows (`.yaml` / `.yml` files with a `steps:` list) are still fully
> supported, and are rendered in the same notebook UI.

## The web UI

Start it with `lab34-flows --server` (or `npm run dev:full` in development) and
open <http://localhost:3001>.

- **Sidebar › Flows** — your flows tree, with a live status dot per flow
  (*standby*, *running*, *ok*, *error*).
- **Sidebar › Applications** — every application in your context directory, with
  the number of methods it exports. Click one to read its README and browse its
  methods: input parameters, output, memory usage and examples.
- **Sidebar footer › Environment** — the environment every run uses.
- **Notebook view** — the flow as a document, each step block a cell. Press *Run*
  and the details stream in below each block.
- **Document / Source toggle** — *Source* opens the raw Markdown in an editor and
  saves it back to disk.
- **Magic wand** — describe a change and the model rewrites the document.
- **Settings**, with one section per concern: **AI**, **Xray**, **UI** (theme:
  light, dark or auto, kept in your browser) and **Help** — every guide and
  reference the tool ships with, searchable, so you never have to leave the app
  to look something up.

<div align="center">

<img src="https://raw.githubusercontent.com/lab34-es/lab34-flows/master/docs/assets/ui-help.png" alt="Settings › Help: the built-in, searchable documentation, grouped by topic" width="900">

</div>

<div align="center">

<img src="https://raw.githubusercontent.com/lab34-es/lab34-flows/master/docs/assets/ui-application.png" alt="An application page: its README and its methods, documented from the JSDoc of index.js" width="900">

</div>

### Managing files and folders

Everything you can do to a file on disk you can do from the UI — and it *is* the
file on disk that changes.

**Flows.** The `+` next to *Flows* creates a flow or a folder at the root,
uploads an existing file, or refreshes the tree after you changed something by
hand. Every folder row has the same menu, scoped to that folder, and every row's
`…` menu renames and deletes. A new flow gets a `.md` extension when you do not
type one; renaming keeps the extension the file already had. Deleting asks
first, and is permanent.

**Application files.** Open an application and switch to **Source**: the left
pane is a file explorer over the whole application folder — `index.js`,
`README.md`, `env/*.env` and anything else you put there — and the right pane is
the editor. The *new file* button creates a file at the root of the application,
a folder's `…` menu creates one inside it, and typing a path like
`helpers/http.js` creates the folders for you. A dot next to a file name means
it has unsaved changes.

Renaming the application itself is in the sidebar, on the application's own `…`
menu: it renames the folder, so every flow that calls it by name has to be
updated too.

<div align="center">

<img src="https://raw.githubusercontent.com/lab34-es/lab34-flows/master/docs/assets/ui-source.png" alt="The Source view of an application: a file explorer on the left, an editor on the right" width="900">

</div>

### Writing flows with AI

Flows can be written for you from a plain description of the scenario. This lives
in the web UI, not in the CLI: that is where the provider, the model and the API
keys are configured.

#### Configure a provider

Open **Settings › AI** and pick one of:

| Provider | What you need |
|-|-|
| **Ollama (local)** | A running Ollama and a pulled model (`ollama pull llama3.1`). Nothing leaves your machine. |
| **Google Gemini** | An API key from [aistudio.google.com](https://aistudio.google.com/app/apikey). Defaults to `gemini-2.5-flash`. |
| **Anthropic (Claude)** | An API key from [console.anthropic.com](https://console.anthropic.com). Defaults to `claude-opus-5`. |

Use **Test connection** to check the settings before generating anything: it
does a real round trip, so it also catches a wrong model name or an Ollama that
is not running.

Settings are stored in your context folder, at `config/ai.json`:

```json
{
  "provider": "anthropic",
  "providers": {
    "ollama": { "model": "llama3.1", "host": "http://127.0.0.1:11434" },
    "gemini": { "model": "gemini-2.5-flash", "apiKey": "..." },
    "anthropic": { "model": "claude-opus-5", "apiKey": "..." }
  }
}
```

Keys are never sent back to the browser: the UI only learns whether one is
stored. An older `ai.json` written for the Gemini-only version is migrated
automatically the first time it is read.

#### Create a flow with AI

When creating a flow, turn on **Create using AI** under the file name. The file
is created first — so it exists whatever happens next — and a second dialog asks
what it should test:

> Create a post on jsonplaceholder with a random title, check it comes back with
> a 201, and then fetch a post that does not exist.

What comes back is a Markdown flow: frontmatter, prose explaining each part and
```` ```step ```` blocks built from the applications you actually have. The
generated document is checked before it is saved — it has to parse, contain at
least one step, and only use applications and methods that exist — and the model
gets one chance to fix its own mistakes before the error reaches you.

#### Edit a flow with AI

Open any flow and use the **magic wand** next to the Document/Source toggle:
describe the change ("also cover the unhappy path", "explain each section") and
the whole document is rewritten. The result lands in the editor as an **unsaved**
change, so you can read it — and reload to throw it away — before saving.

## Command line

```bash
lab34-flows --help
lab34-flows --server [--context <path>]
lab34-flows --file <path-to-flow-file> --env <environment> [--debug]
lab34-flows --capabilities
```

| Flag | What it does |
|-|-|
| `--file` | Path to the flow (`.md`, `.markdown`, `.yaml` or `.yml`). Required unless `--server`. |
| `--env` | Environment to run in. Required with `--file`. |
| `--server` | Start the web UI (builds the frontend and serves it on <http://localhost:3001>). |
| `--capabilities` | List every application and method available in the context. |
| `--context` | Use another context directory instead of `~/lab34-flows`. It has to exist. |
| `--debug` | Print the environment variables and Node.js paths as the tool sees them. |
| `--help` | Show the help. |
| `-v` | Print the version and exit. |

`--file` is resolved **inside** the context directory, so
`--file flows/my-flow.md` means `~/lab34-flows/flows/my-flow.md`.

```bash
# Run a flow from another context, with debug information
lab34-flows --context ./my-project --file flows/my-flow.md --env production --debug
```

## Applications

Applications live in the `applications` folder of your context directory. Each
one is a Node.js module that exports methods, and each method is what a step can
call. They can talk to HTTP APIs, MQTT, PostgreSQL databases, or drive a browser
with Playwright.

### Application docs (JSDoc)

Applications document themselves in their own code: there is no `docs.json`. The
documentation is read from the JSDoc blocks of the application's `index.js`, and
it is what the UI renders *and* what the model is given when it writes a flow for
you — the better the JSDoc, the better the generated flows.

- The block at the **top of the file** describes the application.
- The block **above each exported method** documents that method: its free text
  is the description (markdown), and its tags describe the rest.

| Tag | Meaning |
|-|-|
| `@param {type} name - description` | An input parameter. `[name]` marks it optional, `[name=value]` adds a default |
| `@returns {status} description` | The response. An optional fenced ```` ```json ```` block documents an example body |
| `@memory {write\|read} key - description` | Flow memory the method writes or reads |
| `@example` | An example step, in YAML, ready to paste inside a ```` ```step ```` block |

```js
/**
 * What this application is.
 */
const { applications } = require('lab34-flows');

/**
 * Adds two numbers (a + b).
 *
 * @param {number} body.a - First operand.
 * @param {number} [body.b=0] - Second operand.
 * @returns {200} The operation performed and its result.
 * ```json
 * { "operation": "add", "result": 42 }
 * ```
 * @memory {write} lastResult - The result of the operation.
 * @example
 * application: myApp
 * method: add
 * parameters:
 *   body:
 *     a: 2
 *     b: 40
 */
module.exports.add = applications.handler([
  async (ctx, parameters) => {
    const { a, b } = parameters.body;
    return [{}, 200, { operation: 'add', result: a + b }, { lastResult: a + b }];
  }
], 'add');
```

A `README.md` in the application folder is rendered in the UI as well.

## Assertions and tests

The `test` section of a step asserts the response. Plain values are compared for
equality, and the body is matched key by key, as deep as you write it:

```yaml
test:
  status: 400
  body:
    error:
      code: DIVISION_BY_ZERO
```

### JavaScript expressions in tests

For anything beyond equality, prefix the value with `$expr:` and write
JavaScript, where `value` is the actual value being tested:

```yaml
test:
  body:
    count: "$expr: value > 10"              # count is greater than 10
    status: "$expr: value === 'completed'"  # status equals 'completed'
    items: "$expr: Array.isArray(value) && value.length >= 3"
    user:
      age: "$expr: value >= 18 && value <= 65"
    timestamp: "$expr: new Date(value).getFullYear() === 2023"
```

| Validation type | Expression example |
|-|-|
| Greater than | `$expr: value > 0` |
| Equals specific value | `$expr: value === 2` |
| In a range | `$expr: value >= 5 && value <= 10` |
| String contains | `$expr: typeof value === 'string' && value.includes('success')` |
| Array has items | `$expr: Array.isArray(value) && value.length > 0` |
| Property exists | `$expr: typeof value === 'object' && 'id' in value` |
| Date validation | `$expr: new Date(value) > new Date('2023-01-01')` |

Cover the unhappy paths too: asserting that a missing resource returns `404` is
what catches the regression that starts answering `200`.

## Mimicking dependencies

A step can replace the behaviour of a dependency it triggers, which is how you
reproduce failure scenarios without breaking anything for real:

````markdown
```step
application: "accounting"
method: "getInvoice"
parameters:
  params:
    customerId: "{{ randomInt0_100 }}"
mimic:
  - application: "coinscrap"
    url: "/fraud-detection"
test:
  status: 404
  body:
    error:
      code: "ACCOUNTING_FRAUD_DETECTED"
```
````

Mimicked responses go through the same replacers as the rest of the flow, so they
can contain `{{ uuid }}`, `{{ randomEmail }}` and friends.

## Latent applications (MQTT)

**Only works for MQTT at the moment.**

Some effects do not come back in the response: an HTTP call triggers a job that
eventually publishes an MQTT message. Latent applications let you assert on
those.

Declare the client in the flow's frontmatter, so it is connected and subscribed
before the flow starts:

```yaml
latentApplications:
  - application: "mqtt"
    client: "client1"
    connection:
      host: "1234567890-ats.iot.eu-west-1.amazonaws.com"
      key: "/Users/myuser/mqtt-credentials/private.key"
      cert: "/Users/myuser/mqtt-credentials/cert.crt"
      ca: "/Users/myuser/mqtt-credentials/ca1.pem"
    subscribe:
      - topic: "client/1"
```

Then assert on it from any step. Note that the retry of a latent application is
configured with `attempts`, not `times`:

```yaml
test:
  latentApplications:
    - application: "mqtt"
      client: "client1"
      test:
        - topic: "client/1"
          message:
            status: "switched_to_on"
      retry:
        attempts: 1
        delay: 1
```

## Browser automation (Playwright)

Web applications are tested through [Playwright](https://playwright.dev).
Playwright automations have their **own YAML files**, and an application
integrates with them by calling `playwright.run` with the path to one.

This part is **experimental**.

### Configuration

The same YAML file carries the browser configuration and the steps:

```yaml
# Browser configuration
browserType: chromium   # chromium (default), firefox, webkit
device: Desktop Chrome  # any device from playwright.devices; iPhone 11 Pro by default
keepOpen: true          # keep the browser open after execution (debugging only)

# Launch options
launchOptions:
  headless: false
  ignoreHTTPSErrors: true
  timeout: 30000
  args: []              # additional browser arguments

# Context options
contextOptions:
  locale: en-US
  timezoneId: Europe/Madrid
  permissions: []
  viewport:
    width: 1280
    height: 720

steps:
  - method: goto
    parameters:
      url: "https://example.com"
```

### Available methods

| Method | Description | Parameters |
|-|-|-|
| `goto` | Navigate to a URL | `url`, `waitUntil`, `timeout` |
| `click` | Click on an element | `selector`, `button`, `clickCount`, `delay`, `timeout` |
| `type` | Type text into a form field | `selector`, `text`, `delay`, `timeout` |
| `fill` | Fill a form field | `selector`, `value`, `timeout` |
| `press` | Press a key | `selector`, `key`, `delay`, `timeout` |
| `hover` | Hover over an element | `selector`, `position`, `timeout` |
| `dragAndDrop` | Drag and drop | `source`, `target`, `force`, `timeout` |
| `selectOption` | Select a dropdown option | `selector`, `values`, `timeout` |
| `check` | Check a checkbox | `selector`, `position`, `timeout` |
| `uncheck` | Uncheck a checkbox | `selector`, `position`, `timeout` |
| `evaluate` | Execute JavaScript | `pageFunction`, `arg` |
| `keyboard` | Keyboard actions | `action`, `args` |
| `mouse` | Mouse actions | `action`, `args` |
| `waitForTimeout` | Wait for a time | `time` |
| `waitForSelector` | Wait for an element | `selector`, `state`, `timeout` |
| `screenshot` | Take a screenshot | `path`, `fullPage`, `omitBackground` |
| `waitForInput` | Wait for user input | – |
| `scrape` | Extract page data | `selector`, `output` |

> `assert`, `route`, `dblclick` and `focus` are accepted by the validator but not
> implemented yet: a step using them is silently skipped.

### Method examples

```yaml
method: goto
parameters:
  url: "https://example.com"
  waitUntil: "networkidle"   # load, domcontentloaded, networkidle
  timeout: 30000
```

```yaml
method: click
parameters:
  selector: "#submit-button"
  button: "left"             # left, right, middle
  clickCount: 1
  delay: 100
  timeout: 5000
```

```yaml
method: type
parameters:
  selector: "#search"
  text: "An example search"
  delay: 50                  # milliseconds between keystrokes
  timeout: 5000
```

```yaml
method: fill
parameters:
  selector: "#username"
  value: "user123"
  timeout: 5000
```

```yaml
method: press
parameters:
  selector: "#search-input"
  key: "Enter"
  delay: 100
  timeout: 5000
```

```yaml
method: hover
parameters:
  selector: ".dropdown-menu"
  position: { x: 0, y: 0 }   # relative to the element
  timeout: 5000
```

```yaml
method: dragAndDrop
parameters:
  source: "#draggable"
  target: "#droppable"
  force: true
  timeout: 5000
```

```yaml
method: selectOption
parameters:
  selector: "#country-select"
  values: ["ES"]             # a single string or an array
  timeout: 5000
```

```yaml
method: check
parameters:
  selector: "#terms-checkbox"
  position: { x: 5, y: 5 }   # optional
  timeout: 5000
```

```yaml
method: evaluate
parameters:
  pageFunction: "() => document.title"
  arg: null
```

```yaml
method: keyboard
parameters:
  action: "type"
  args: ["Hello World", { delay: 100 }]
```

```yaml
method: mouse
parameters:
  action: "move"
  args: [100, 200]           # x, y coordinates
```

```yaml
method: waitForSelector
parameters:
  selector: ".loading-indicator"
  state: "hidden"            # attached, detached, visible, hidden
  timeout: 30000
```

```yaml
method: screenshot
parameters:
  path: "screenshots/error-state.png"
  fullPage: true
  omitBackground: false
```

Whatever `scrape` collects is returned to the flow as the step's response body:

```yaml
method: scrape
parameters:
  title:
    selector: "h1"
    output: "string"
  price:
    selector: ".price"
    output: "number"
  isAvailable:
    selector: ".stock-status"
    output: "boolean"
  publishDate:
    selector: ".publish-date"
    output: "date"
```

## Replacers

Replacers customise the requests of the steps and the responses of the mimicked
applications, with values generated on every run. They are Handlebars templates:
write `{{ randomInt0_100 }}` and it becomes a different number each time the flow
runs.

### Basic replacers

| Replacer | Description | Example |
|-|-|-|
| `timestamp` | Current timestamp in milliseconds | `1633024800000` |
| `datetime` | Current date and time in ISO format | `2023-10-01T12:00:00.000Z` |
| `randomInt` | Random integer between 0 and 999 | `42` |
| `randomInt0_5` | Random integer between 0 and 4 | `3` |
| `randomInt0_10` | Random integer between 0 and 9 | `7` |
| `randomInt0_100` | Random integer between 0 and 99 | `56` |
| `randomInt0_200` | Random integer between 0 and 199 | `123` |
| `randomInt0_300` | Random integer between 0 and 299 | `250` |
| `randomInt0_500` | Random integer between 0 and 499 | `400` |
| `randomInt0_1000` | Random integer between 0 and 999 | `789` |
| `randomInt0_2000` | Random integer between 0 and 1999 | `1500` |
| `randomInt0_3000` | Random integer between 0 and 2999 | `2500` |
| `randomInt0_4000` | Random integer between 0 and 3999 | `3500` |
| `randomInt0_5000` | Random integer between 0 and 4999 | `4500` |
| `randomInt0_9999` | Random integer between 0 and 9998 | `6789` |
| `uuid` | Random UUID | `123e4567-e89b-12d3-a456-426614174000` |
| `randomPostmanId` | Random 6-digit integer | `123456` |

### Personal data replacers

| Replacer | Description | Example |
|-|-|-|
| `randomEmail` | Randomly generated email address | `user123@example.com` |
| `randomName` | Random person full name | `John Doe` |
| `randomPersonName` | Random person first name | `Jane` |
| `randomPersonSurname` | Random person last name | `Smith` |
| `randomPersonPrefix` | Random person name prefix | `Mr.` |
| `phoneIntl` | Random phone number in international format | `+1 555-123-4567` |
| `randomString` | Random alphanumeric string (10 characters) | `a1b2c3d4e5` |

### Location and company replacers

| Replacer | Description | Example |
|-|-|-|
| `belgianCityEn` | Random Belgian city name in English | `Brussels` |
| `randomCompanyName` | Random company name | `Acme Corporation` |
| `randomStreet` | Random street name | `Main Street` |
| `randomStreetNumber` | Random street number between 0 and 199 | `42` |
| `randomPostalCode` | Random 4-digit postal code | `1000` |

### Time-related functions

Generate dates and timestamps in the past with:

```text
timeAgo amount lapse
timestampAgo amount lapse
tsAgo amount lapse
```

Where `amount` is the number of time units to go back and `lapse` is the unit
(`ms`, `seconds`, `minutes`, `hours`, `days`, `months`, `years`):

```text
timeAgo 5 "days"       <!-- a Date object 5 days in the past -->
timestampAgo 2 "hours" <!-- a timestamp in milliseconds from 2 hours ago -->
tsAgo 1 "month"        <!-- a formatted timestamp (YYYYMMDDHHMMSS) from 1 month ago -->
```

### Barcode generation

```javascript
barcode([pattern])
```

Where `pattern` is an array of strings and/or numbers: a string is a fixed value,
and a number adds N digits to the barcode.

```javascript
barcode(["123456", 3, "789"])   // "123456123789"
barcode(["HELLO-", 4, "-WORLD"]) // "HELLO-7832-WORLD"
```

### Random selection

```javascript
oneOf([array])   // picks one element at random
```

You can contribute and add more replacers by modifying `src/helpers/replacer.js`.

## Environments and secrets

Credentials are never stored in the flows. Each application keeps one env file
per environment, in its own folder:

```text
applications/<app>/env/<environment>.env
```

The name of the file *is* the name of the environment: `env/staging.env` is what
the sidebar offers as **staging**, and the list you can pick from is the union of
the env files of every application.

The *Applications* page edits those files — variable by variable, or as raw text
— without leaving the UI. Variables named `secret`, `token`, `credential`,
`password`, `authorization` or `x-api-key` are masked in that list, with only
their last four characters visible.

### PostgreSQL database configuration

The PostgreSQL client supports flexible configuration through environment
variables. You can either use a connection string or individual parameters.

#### Option 1: connection string (recommended for simplicity)

```bash
DATABASE_CONNECTION_STRING=postgres://user:password@host:5432/database
```

#### Option 2: individual parameters (recommended for flexibility)

| Environment variable | Description | Example |
|-|-|-|
| `PGUSER` | Database user | `myuser` |
| `PGPASSWORD` | Database password | `mypassword` |
| `PGHOST` | Database host | `localhost` or `db.example.com` |
| `PGPORT` | Database port | `5432` |
| `PGDATABASE` | Database name | `mydatabase` |
| `PGQUERY_TIMEOUT` | Query timeout in milliseconds | `30000` |
| `PGLOCK_TIMEOUT` | Lock timeout in milliseconds | `10000` |
| `PGCLIENT_ENCODING` | Client character encoding | `UTF8` |
| `PGOPTIONS` | Command-line options for the server | `-c statement_timeout=30s` |

`DATABASE_CONNECTION_STRING` takes precedence when both are present. Additional
parameters (`PGQUERY_TIMEOUT`, `PGLOCK_TIMEOUT`…) work with both approaches.

#### SSL configuration (optional)

| Environment variable | Description | Example |
|-|-|-|
| `PGSSL_ENABLED` | Enable SSL connection | `true` or `false` |
| `PGSSL_REJECT_UNAUTHORIZED` | Reject unauthorized certificates | `true` or `false` |
| `PGSSL_CA` | Path to CA certificate file | `/path/to/ca.pem` |
| `PGSSL_CERT` | Path to client certificate file | `/path/to/client-cert.pem` |
| `PGSSL_KEY` | Path to client key file | `/path/to/client-key.pem` |

```bash
# Local development
PGUSER=developer
PGPASSWORD=localpass
PGHOST=localhost
PGPORT=5432
PGDATABASE=testdb

# Production, with full certificate validation
DATABASE_CONNECTION_STRING=postgres://admin:secret@secure.db.example.com:5432/production
PGSSL_ENABLED=true
PGSSL_CA=/path/to/ca-certificate.pem
PGSSL_CERT=/path/to/client-certificate.pem
PGSSL_KEY=/path/to/client-key.pem
```

## Where things live

Everything is stored in your **context directory**, which is `~/lab34-flows` by
default and can be changed with `--context <path>`:

| Path | What it holds |
|-|-|
| `flows/` | Your flows — the tree you see in the sidebar |
| `applications/` | One folder per application: `index.js`, `README.md`, `env/*.env` |
| `config/ai.json` | AI provider, model and API keys |
| `config/jira.json` | Jira / Xray credentials |
| `.examples-seeded` | Marker written the first time the examples are copied |

Credentials never leave your machine except to reach the provider or Jira, and
they are never sent back to the browser: the UI is only told whether a secret is
stored. The theme you pick under *Settings › UI* is the exception — it is kept in
your browser's local storage, not in the context folder.

## Jira / Xray integration

Flows can be linked to [Xray](https://www.getxray.app/), the test management app
for Jira. The mapping is:

| lab34-flows | Xray |
|-|-|
| a flow (one Markdown document) | a **Test** issue |
| every ```` ```step ```` block of that flow | a **step** of that test |

The link is declared in the flow itself, so it travels with the document:

- `xray.testKey` in the frontmatter — the Test this flow represents.
- `testKey` inside a step block — optional, and informative only for now.

````markdown
---
title: Fraud detection
description: A payment above the limit is held for review
xray:
  testKey: BOP-1234
---

# Fraud detection

The customer pays more than their daily limit.

```step
application: payments
method: pay
testKey: BOP-1235
parameters:
  body:
    amount: 5000
```
````

With the integration configured, opening the flow in the web UI shows the Test's
summary and status next to the title (and next to each step that has its own
key), linked to the issue in Jira.

**Uploading executions to Xray is not supported yet**: this is configuration and
visualization only.

### Configuring it

Open **Settings › Xray** and fill in the *Jira / Xray* card. The credentials are
stored in your context folder, at `config/jira.json`, and never leave your
machine except to reach Jira or Xray. Two flavours are supported:

- **Xray Cloud** — data comes from Xray's own API, authenticated with an API key.
  Create it in Jira at **Apps › Xray › API Keys**, and paste the *client id* and
  the *client secret*. Keep the default Xray URL
  (`https://xray.cloud.getxray.app`) unless your instance uses a regional
  endpoint (`https://eu.xray.cloud.getxray.app`,
  `https://us.xray.cloud.getxray.app`).
- **Jira Server / Data Center** — there is no external service: the data is read
  from Jira itself with a **personal access token**, which you create in Jira at
  **your profile › Personal Access Tokens**.

In both cases, **Jira URL** (e.g. `https://your-company.atlassian.net`) is what
every test key is linked to. **Project key** is optional and only kept for
reference. **Test connection** validates the credentials for real, against Xray
(Cloud) or against Jira's `myself` endpoint (Server/DC).

Nothing is downloaded until a flow that mentions a test key is rendered, and
every key is downloaded at most once per run of the tool. When the integration is
not configured the UI shows no Xray information at all, and when Jira cannot be
reached the key is shown as plain text with the error on hover — a flow never
fails to render, or to run, because of Jira.

## Bundled examples

On first run, the tool seeds your context directory with example content:

| Example | Type | What it shows |
|-|-|-|
| `calculator` | application | Fully offline; parameters, error scenarios, flow memory |
| `httpbin` | application | HTTP testing against httpbin.org (query, body, status codes, delays) |
| `jsonplaceholder` | application | CRUD-style fake REST API, memory between steps |
| `examples/01-welcome.md` | flow | Guided tour of Markdown flows (works offline) |
| `examples/02-http-basics.md` | flow | Query params, random data, error statuses |
| `examples/03-posts-and-memory.md` | flow | Collections, `$expr` assertions, memory |

They are copied **once**, on first start, and never again — so editing or
deleting them is safe. To get them back, delete the `.examples-seeded` file in
your context directory and restart.

## Development

```bash
git clone https://github.com/lab34-es/lab34-flows.git
cd lab34-flows

npm install
npm run install:frontend

npm run dev:full        # API on :3001 and the Vite dev server on :3000
npm test                # Jest
npm run lint            # ESLint (npm run lint:fix to autofix)
```

| Script | What it does |
|-|-|
| `npm run dev` | API only, with nodemon |
| `npm run frontend` | Vite dev server only, proxying `/api` to `:3001` |
| `npm run dev:full` | Both at once |
| `npm run build:frontend` | Build the frontend into `frontend/dist` |
| `npm run dev:prod` | Build the frontend and serve everything from `:3001` |

The frontend is React 19 + Vite, [Tailwind CSS](https://tailwindcss.com) and
[shadcn/ui](https://ui.shadcn.com) components, with Monaco as the editor and
Socket.IO for the live execution updates.

Bugs and ideas are welcome at
[github.com/lab34-es/lab34-flows/issues](https://github.com/lab34-es/lab34-flows/issues).

## License

[MIT](LICENSE) © Jose Constela
