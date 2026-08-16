# Flows

Heavily opinionated tool to help you test E2E flows and behaviours.

> Trigger, understand and test E2E flows and behaviours.
> Ask an AI to generate a flow for you.
> Run on any environment (staging, production, etc).
> From Async protocols, APIs and databases, to web applications.

Features:

- Define flows as **Markdown documents**: write any content — prose, headings, lists — and mark the executable steps as ```` ```step ```` code blocks. (Legacy YAML flows keep working.)
- **Notebook-style UI**: run a flow and the execution details of each step (request, response, assertions, timings) appear right below its code block.
- Web UI built with [shadcn/ui](https://ui.shadcn.com): sidebar with your flows (with live status indicators), folders, uploads, and your applications with their docs.
- Ships with **example applications and flows** (calculator, httpbin, jsonplaceholder), seeded on first run.
- **Write flows with AI** from the web UI: describe the scenario and get a Markdown flow built from your own applications — or hand an existing flow to the magic wand to change it.
- Bring your own model: **local Ollama**, **Google Gemini** or **Anthropic (Claude)**, configured in the Settings screen.
- Define test cases for each step in a way that can be used for CI/CD automation.
- Mimic and customise the behaviour of dependant applications. (i.e. fail scenarios under user defined circusnstances).
- Test with randomly generated data - on each attempt.
- Integrates with MQTT, HTTP apis, PostgreSQL databases and web applications.
- Keeps environment variables in a safe place.
- Offers a comprehensive view of the flowing information (headers, body, etc).
- Built-in replacers for customising requests and responses.
- Retry / delay mechanism for failed steps.
- Test flows locally, mimicing dependent applications, without leaving the comform of your localhost.

## Table of contents

- [Flows tools](#flows-tool)
  - [Table of contents](#table-of-contents)
  - [General info](#general-info)
  - [Setup](#setup)
  - [Usage](#usage)
    - [Writing flows with AI](#writing-flows-with-ai)
  - [Web UI](#web-ui)
  - [Jira / Xray integration](#jira--xray-integration)
  - [Default examples](#default-examples)
  - [Application docs (JSDoc)](#application-docs-jsdoc)
  - [Flows](#flows)
  - [Tests](#tests)
  - [Playwright](#playwright) (browser automation - experimental)
  - [Replacers](#replacers)
  - [Environment variables](#environment-variables)

## General info

This tool is intended to help you test E2E flows and behaviours.

The list of steps to execute are defined in files called "flows", located in
the `flows` folder of your context directory (`~/lab34-flows` by default).

A flow is a **Markdown document**. You can write any content — headings,
prose, lists, images — and turn any part of it into an executable step with a
fenced code block tagged as `step`. The content of a step block is YAML,
using the same step schema as before (application, method, parameters, test,
mimic, retry...).

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

The tool reads the flow and executes the steps in the order they appear in
the document. In the web UI, the execution details of each step (request,
response, assertions, timings) are displayed right below its code block —
like a notebook.

Flow-level metadata goes in an optional YAML frontmatter at the top
(`title`, `description`, `version`, `latentApplications`...). When there is
no frontmatter title, the first `# heading` is used.

Additionally:
1. You can mimic the behaviour of dependant applications, by adding a *mimic* section to each step's definition.
2. You can define test cases for each step, and the tool will execute them.

> Legacy YAML flows (`.yaml` / `.yml` files with a `steps:` list) are still
> fully supported, and are rendered in the same notebook UI.

## Setup

```bash
# Install this repository, globally.

npm install -g @lab34/flows

# Extend NODE_PATH to npm's root, so your application scripts can access the library:
# On Linux / MacOS:
export NODE_PATH=$(npm root -g)

# On Windows:
set NODE_PATH=%AppData%\npm\node_modules

# On NVM for Windows:
set NODE_PATH=%NVM_SYMLINK%\node_modules

# On NVM for Windows (powershell)
$env:NODE_PATH = "$env:NVM_SYMLINK\node_modules"
```

## Usage

The Lab34 Flows CLI tool provides a professional command-line interface for running flow definitions (Markdown or YAML), and a web UI.

### Usage

```bash
lab34-flows --help
lab34-flows --file <path-to-flow-file> --env <environment> [--debug] [--help]
lab34-flows --server
lab34-flows --capabilities
```

### Options

|Parameter|Description|
|-|-|
|`--file`|Path to the flow definition file, `.md` or `.yaml` (required if not using --server)|
|`--server`|Start the web UI (builds the frontend and serves it on http://localhost:3001)|
|`--env`|Environment to run the flow in (required for --file)|
|`--debug`|Print debug information including environment variables and Node.js variables|
|`--help`|Show help information|

### Examples

Display help information:
```bash
lab34-flows --help
```

Run a flow with debug information:
```bash
lab34-flows --file flows/my-flow.md --env production --debug
```

### Writing flows with AI

Flows can be written for you from a plain description of the scenario. This
lives in the web UI (`lab34-flows --server`), not in the CLI: that is where the
provider, the model and the API keys are configured.

#### Configure a provider

Open **Settings** in the sidebar and pick one of:

|Provider|What you need|
|-|-|
|**Ollama (local)**|A running Ollama and a pulled model (`ollama pull llama3.1`). Nothing leaves your machine.|
|**Google Gemini**|An API key from [aistudio.google.com](https://aistudio.google.com/app/apikey).|
|**Anthropic (Claude)**|An API key from [console.anthropic.com](https://console.anthropic.com). Defaults to `claude-opus-5`.|

Use **Test connection** to check the settings before generating anything.

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
is created first — so it exists whatever happens next — and a second dialog
asks what it should test:

> Create a post on jsonplaceholder with a random title, check it comes back
> with a 201, and then fetch a post that does not exist.

What comes back is a Markdown flow: frontmatter, prose explaining each part and
```` ```step ```` blocks built from the applications you actually have. The
generated document is checked before it is saved — it has to parse, contain at
least one step, and only use applications and methods that exist — and the
model gets one chance to fix its own mistakes before the error reaches you.

#### Edit a flow with AI

Open any flow and use the **magic wand** next to the Document/Source toggle:
describe the change ("also cover the unhappy path", "explain each section")
and the whole document is rewritten. The result lands in the editor as an
**unsaved** change, so you can read it — and reload to throw it away — before
saving.

### Debug Mode

When the `--debug` flag is used, the CLI tool will print detailed information about:

1. All environment variables
2. Node.js variables including:
   - `__dirname`: The directory name of the current module
   - `__filename`: The file name of the current module
   - `process.cwd()`: The current working directory
   - `process.argv`: The command line arguments

This information is useful for troubleshooting and understanding the execution environment.

## Replacers

Replacers are used to customize the requests and responses of the steps in the flow, as well as the mimicked applications. The tool uses Handlebars templates for replacements.

For example, you can define a value like `{{ randomInt0_100 }}` in the flow file, or in the mimicked application responses, and the tool will replace it with a randomly generated integer between 0 and 100.

### Basic Replacers

The following basic replacers are available:

| Replacer          | Description                                      | Example                          |
|-------------------|--------------------------------------------------|----------------------------------|
| `timestamp`       | Current timestamp in milliseconds                | `1633024800000`                  |
| `datetime`        | Current date and time in ISO format              | `2023-10-01T12:00:00.000Z`       |
| `randomInt`       | Random integer between 0 and 999                 | `42`                             |
| `randomInt0_5`    | Random integer between 0 and 4                   | `3`                              |
| `randomInt0_10`   | Random integer between 0 and 9                   | `7`                              |
| `randomInt0_100`  | Random integer between 0 and 99                  | `56`                             |
| `randomInt0_200`  | Random integer between 0 and 199                 | `123`                            |
| `randomInt0_300`  | Random integer between 0 and 299                 | `250`                            |
| `randomInt0_500`  | Random integer between 0 and 499                 | `400`                            |
| `randomInt0_1000` | Random integer between 0 and 999                 | `789`                            |
| `randomInt0_9999` | Random integer between 0 and 9998                | `6789`                           |
| `randomInt0_2000` | Random integer between 0 and 1999                | `1500`                           |
| `randomInt0_3000` | Random integer between 0 and 2999                | `2500`                           |
| `randomInt0_4000` | Random integer between 0 and 3999                | `3500`                           |
| `randomInt0_5000` | Random integer between 0 and 4999                | `4500`                           |
| `uuid`            | Random UUID                                      | `123e4567-e89b-12d3-a456-426614174000` |
| `randomPostmanId` | Random 6-digit integer                           | `123456`                         |

### Personal Data Replacers

| Replacer              | Description                                  | Example                          |
|-----------------------|----------------------------------------------|----------------------------------|
| `randomEmail`         | Randomly generated email address             | `user123@example.com`            |
| `randomName`          | Random person full name                      | `John Doe`                       |
| `randomPersonName`    | Random person first name                     | `Jane`                           |
| `randomPersonSurname` | Random person last name                      | `Smith`                          |
| `randomPersonPrefix`  | Random person name prefix                    | `Mr.`                            |
| `phoneIntl`           | Random phone number in international format  | `+1 555-123-4567`                |
| `randomString`        | Random alphanumeric string (10 characters)   | `a1b2c3d4e5`                     |

### Location and Company Replacers

| Replacer              | Description                                  | Example                          |
|-----------------------|----------------------------------------------|----------------------------------|
| `belgianCityEn`       | Random Belgian city name in English          | `Brussels`                       |
| `randomCompanyName`   | Random company name                          | `Acme Corporation`               |
| `randomStreet`        | Random street name                           | `Main Street`                    |
| `randomStreetNumber`  | Random street number between 0 and 199       | `42`                             |
| `randomPostalCode`    | Random 4-digit postal code                   | `1000`                           |

### Time-Related Functions

You can generate dates and timestamps in the past using the following helper functions:

```text
timeAgo amount lapse 
timestampAgo amount lapse 
tsAgo amount lapse 
```

Where:
- `amount`: The number of time units to go back
- `lapse`: The time unit (ms, seconds, minutes, hours, days, months, years)

Examples:
```text
timeAgo 5 "days"       <!-- Returns a Date object 5 days in the past -->
timestampAgo 2 "hours" <!-- Returns a timestamp in milliseconds from 2 hours ago -->
tsAgo 1 "month"        <!-- Returns a formatted timestamp (YYYYMMDDHHMMSS) from 1 month ago -->
```

### Barcode Generation

You can generate random barcodes using the barcode helper:

```javascript
barcode([pattern])
```

Where:
- `pattern`: is an array of strings and/or numbers.
  - An string is a fixed value.
  - A number adds N number of numbers to the barcode.

Examples:
```javascript
barcode(["123456", 3, "789"]) // Generates a barcode like "123456123789"
barcode(["HELLO-", 4, "-WORLD"]) // Generates a barcode like "HELLO-7832-WORLD"
```

### Random Selection

You can select a random element from an array using the oneOf helper:

```javascript
oneOf([array])
```

You can contribute and add more replacers by modifying the `src/helpers/replacer.js` file.

## Web UI

Start it with `lab34-flows --server` (or `npm run dev:full` in development)
and open http://localhost:3001.

- **Left sidebar** with two sections:
  - **Flows** — your flows tree, with a live status indicator per flow
    (*standby*, *running*, *ok*, *error*). Create folders, create flows,
    upload files and delete them from the `+` menu and each row's actions.
  - **Applications** — every application in your context directory. Click
    one to read its **README** and browse its **methods** (input parameters,
    output, memory usage and examples, from the JSDoc blocks of its
    `index.js`), plus its environment files. Like flows, applications have a
    **Document / Source** toggle: the Source view edits the application's
    files (`README.md`, `index.js` and `env/*.env`) right from the UI.
- **Notebook view** — a flow renders as a document; each ```` ```step ````
  block is a cell. Press **Run** and the execution details of each step
  stream in below its block: status, timing, request, response and
  assertions. Edit the raw Markdown in the **Source** tab and save.
- The environment selector (sidebar footer) picks the environment used for
  runs. Light and dark themes are available.

## Jira / Xray integration

Flows can be linked to [Xray](https://www.getxray.app/), the test management
app for Jira. The mapping is:

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

With the integration configured, opening the flow in the Web UI shows the
Test's summary and status next to the title (and next to each step that has
its own key), linked to the issue in Jira.

**Uploading executions to Xray is not supported yet**: this is configuration
and visualization only.

### Configuring it

Open **Settings** in the Web UI and fill in the **Jira / Xray** card. The
credentials are stored in your context folder, at `config/jira.json`, and
never leave your machine except to reach Jira or Xray. Two flavours are
supported:

- **Xray Cloud** — data comes from Xray's own API, authenticated with an API
  key. Create it in Jira at **Apps > Xray > API Keys**, and paste the *client
  id* and the *client secret*. Keep the default Xray URL
  (`https://xray.cloud.getxray.app`) unless your instance uses a regional
  endpoint (`https://eu.xray.cloud.getxray.app`,
  `https://us.xray.cloud.getxray.app`).
- **Jira Server / Data Center** — there is no external service: the data is
  read from Jira itself with a **personal access token**, which you create in
  Jira at **your profile > Personal Access Tokens**.

In both cases, **Jira URL** (e.g. `https://your-company.atlassian.net`) is
what every test key is linked to. **Project key** is optional and only kept
for reference. **Test connection** validates the credentials for real, against
Xray (Cloud) or against Jira's `myself` endpoint (Server/DC).

Nothing is downloaded until a flow that mentions a test key is rendered, and
every key is downloaded at most once per run of the tool. When the integration
is not configured the UI shows no Xray information at all, and when Jira
cannot be reached the key is shown as plain text with the error on hover — a
flow never fails to render, or to run, because of Jira.

## Default examples

On first run, the tool seeds your context directory with example content:

| Example | Type | What it shows |
|-|-|-|
| `calculator` | application | Fully offline; parameters, error scenarios, flow memory |
| `httpbin` | application | HTTP testing against httpbin.org (query, body, status codes, delays) |
| `jsonplaceholder` | application | CRUD-style fake REST API, memory between steps |
| `examples/01-welcome.md` | flow | Guided tour of Markdown flows (works offline) |
| `examples/02-http-basics.md` | flow | Query params, random data, error statuses |
| `examples/03-posts-and-memory.md` | flow | Collections, `$expr` assertions, memory |

Examples are only copied when missing, so you can edit or delete them freely.

## Application docs (JSDoc)

Applications document themselves in their own code: there is no `docs.json`.
The documentation is read from the JSDoc blocks of the application's
`index.js`, and it is what the UI renders and what the model is given when it
writes a flow for you — the better the JSDoc, the better the generated flows.

- The block at the **top of the file** describes the application.
- The block **above each exported method** documents that method: its free
  text is the description (markdown), and its tags describe the rest.

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

## Flows

Flows are defined in Markdown format (see [General info](#general-info));
legacy YAML flows are still supported. Examples are seeded into the `flows`
folder of your context directory.

Though, you can have your own flows in your own computer / repository, and share them with your team.

## Tests

Tests are defined in the flow file, and are executed by the tool.

You can test two aspects on each step:

1. The it has returned the expected status code and body. (i.e. 200, 404, etc, with certain body contents).
2. Lantent applications. See [Latent Applications](#latent-applications) for more information.

### JavaScript Expressions in Tests

You can use JavaScript expressions in your test definitions to perform dynamic validations beyond simple equality checks. To use an expression, prefix it with `$expr:` followed by valid JavaScript code, where `value` represents the actual value being tested.

Examples:

```yaml
test:
  body:
    count: "$expr: value > 10"              # Validates that count is greater than 10
    status: "$expr: value === 'completed'"  # Validates that status equals 'completed'
    items: "$expr: Array.isArray(value) && value.length >= 3"  # Validates items is an array with at least 3 elements
    user:
      age: "$expr: value >= 18 && value <= 65"  # Validates age is between 18 and 65
    timestamp: "$expr: new Date(value).getFullYear() === 2023"  # Validates year is 2023
```

Common validation scenarios:

| Validation Type | Expression Example |
|----------------|-------------------|
| Greater than | `$expr: value > 0` |
| Equals specific value | `$expr: value === 2` |
| In a range | `$expr: value >= 5 && value <= 10` |
| String contains | `$expr: typeof value === 'string' && value.includes('success')` |
| Array has items | `$expr: Array.isArray(value) && value.length > 0` |
| Property exists | `$expr: typeof value === 'object' && 'id' in value` |
| Date validation | `$expr: new Date(value) > new Date('2023-01-01')` |

This feature allows for powerful and flexible test assertions without having to modify the testing code.

## Latent Applications

**Only works for MQTT at the moment**

This are applications that are triggered asynchonously by some step in the flow, for which test validation is important in order to consider a flow as successful.

For example: you might want to validate the, upon triggering a HTTP request, a certain MQTT has been produced at some point. 

To do so, you can define this applications in the `latentApplications` section in the flow.

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

steps: 
  ...
```

In this example, we are ensuring we will have a MQTT client connected to the given host, and subscribed to a list of topics, before the flow starts.

This enables the flow to be able to test that the MQTT messages are being produced as expected.

For example, in the following example, we are ensuring that a MQTT message containing `status = switched_to_on` is received in the `client/1` topic by the client described above.

```yaml
steps:
  - application: "<some application>"
    method: "<some method>"
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

## Playwright

Testing web applications is possible with the tool, as it integrates with [Playwright](https://playwright.dev).

Playwright automations have their own YAML files, as you can see in [an actual example](src/applications/playful_website/playwright.example.yaml).

To integrate with Playwright, the application's code must make use of `playwright.run` and pass a playwright yaml file to it.

### Configuration Options

The Playwright integration now supports enhanced configuration through the YAML file:

```yaml
# Browser configuration
browserType: chromium  # Options: chromium, firefox, webkit
device: Desktop Chrome # Any device from playwright.devices
keepOpen: true  # Keep the browser open after execution (only for debugging purposes)

# Launch options
launchOptions:
  headless: false
  ignoreHTTPSErrors: true
  timeout: 30000
  args: []  # Additional browser arguments

# Context options
contextOptions:
  locale: en-US
  timezoneId: Europe/Madrid
  permissions: []
  geolocation: null
  viewport:
    width: 1280
    height: 720
```

### Available Methods

|Method|Description|Parameters|
|-|-|-|
|goto|Navigate to a URL|`url`, `waitUntil`, `timeout`|
|click|Clicks in a element|`selector`, `button`, `clickCount`, `delay`, `timeout`|
|type|Types a text in a form field|`selector`, `text`, `delay`, `timeout`|
|fill|Fill a form field|`selector`, `value`, `timeout`|
|press|Press a key|`selector`, `key`, `delay`, `timeout`|
|hover|Hover over an element|`selector`, `position`, `timeout`|
|dragAndDrop|Drag and drop operation|`source`, `target`, `force`, `timeout`|
|selectOption|Select dropdown option|`selector`, `values`, `timeout`|
|check|Check a checkbox|`selector`, `position`, `timeout`|
|uncheck|Uncheck a checkbox|`selector`, `position`, `timeout`|
|evaluate|Execute JavaScript|`pageFunction`, `arg`|
|keyboard|Keyboard actions|`action`, `args`|
|mouse|Mouse actions|`action`, `args`|
|waitForTimeout|Wait for time|`time`|
|waitForSelector|Wait for element|`selector`|
|assertTitle|Assert page title|`title`|
|screenshot|Take screenshot|`path`|
|waitForInput|Wait for user input|-|
|scrape|Extract page data|`selector`, `output`|

### Method Examples

#### goto
```yaml
method: goto
parameters:
  url: "https://example.com"
  waitUntil: "networkidle"  # Options: load, domcontentloaded, networkidle
  timeout: 30000
```

#### click
```yaml
method: click
parameters:
  selector: "#submit-button"
  button: "left"  # Options: left, right, middle
  clickCount: 1
  delay: 100
  timeout: 5000
```

#### type
```yaml
method: type
parameters:
  selector: "#search"
  text: "Búsqueda de ejemplo"
  delay: 50  # Milisegundos entre pulsaciones
  timeout: 5000
```

#### fill
```yaml
method: fill
parameters:
  selector: "#username"
  value: "user123"
  timeout: 5000
```

#### press
```yaml
method: press
parameters:
  selector: "#search-input"
  key: "Enter"
  delay: 100
  timeout: 5000
```

#### hover
```yaml
method: hover
parameters:
  selector: ".dropdown-menu"
  position: { x: 0, y: 0 }  # Coordenadas relativas al elemento
  timeout: 5000
```

#### dragAndDrop
```yaml
method: dragAndDrop
parameters:
  source: "#draggable"
  target: "#droppable"
  force: true
  timeout: 5000
```

#### selectOption
```yaml
method: selectOption
parameters:
  selector: "#country-select"
  values: ["ES"]  # Puede ser un string único o un array
  timeout: 5000
```

#### check
```yaml
method: check
parameters:
  selector: "#terms-checkbox"
  position: { x: 5, y: 5 }  # Opcional: coordenadas específicas para el click
  timeout: 5000
```

#### uncheck
```yaml
method: uncheck
parameters:
  selector: "#newsletter-checkbox"
  position: { x: 5, y: 5 }
  timeout: 5000
```

#### dblclick
```yaml
method: dblclick
parameters:
  selector: "#edit-field"
  timeout: 5000
```

#### focus
```yaml
method: focus
parameters:
  selector: "#email-input"
  timeout: 5000
```

#### evaluate
```yaml
method: evaluate
parameters:
  pageFunction: "() => document.title"
  arg: null
```

#### keyboard
```yaml
method: keyboard
parameters:
  action: "type"
  args: ["Hello World", { delay: 100 }]
```

#### mouse
```yaml
method: mouse
parameters:
  action: "move"
  args: [100, 200]  # x, y coordinates
```

#### waitForTimeout
```yaml
method: waitForTimeout
parameters:
  time: 1000  # Milisegundos
```

#### waitForSelector
```yaml
method: waitForSelector
parameters:
  selector: ".loading-indicator"
  state: "hidden"  # Options: 'attached', 'detached', 'visible', 'hidden'
  timeout: 30000
```

#### assertTitle
```yaml
method: assertTitle
parameters:
  title: "Página de inicio"
```

#### screenshot
```yaml
method: screenshot
parameters:
  path: "screenshots/error-state.png"
  fullPage: true  # Opcional: captura toda la página
  omitBackground: false  # Opcional: fondo transparente
```

#### waitForInput
```yaml
method: waitForInput
# No requiere parámetros - espera entrada del usuario
```

#### scrape
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

## Environment variables

To prevent storing credentials and others in the repository, the testers must keep environment files for each supported application in the application folder itself.

i.e. for an application called ABC, the configuration files must be stored in `~/.../applications/abc/envs/ac1.env`.

### PostgreSQL Database Configuration

The PostgreSQL client supports flexible configuration through environment variables. You can either use a connection string or individual parameters.

#### Option 1: Connection String (Recommended for simplicity)

```bash
DATABASE_CONNECTION_STRING=postgres://user:password@host:5432/database
```

#### Option 2: Individual Parameters (Recommended for flexibility)

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `PGUSER` | Database user | `myuser` |
| `PGPASSWORD` | Database password | `mypassword` |
| `PGHOST` | Database host | `localhost` or `db.example.com` |
| `PGPORT` | Database port | `5432` |
| `PGDATABASE` | Database name | `mydatabase` |
| `PGQUERY_TIMEOUT` | Query timeout in milliseconds | `30000` |
| `PGLOCK_TIMEOUT` | Lock timeout in milliseconds | `10000` |
| `PGCLIENT_ENCODING` | Client character encoding | `UTF8` |
| `PGOPTIONS` | Command-line options for the server | `-c statement_timeout=30s` |

#### Configuration Priority

1. If `DATABASE_CONNECTION_STRING` is provided, it takes precedence (for backward compatibility)
2. Otherwise, individual parameters (`PGUSER`, `PGHOST`, etc.) are used
3. Additional parameters (`PGQUERY_TIMEOUT`, `PGLOCK_TIMEOUT`, etc.) work with both approaches

#### SSL Configuration (Optional)

The PostgreSQL client supports SSL connections with flexible configuration options:

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `PGSSL_ENABLED` | Enable SSL connection | `true` or `false` |
| `PGSSL_REJECT_UNAUTHORIZED` | Reject unauthorized certificates | `true` or `false` |
| `PGSSL_CA` | Path to CA certificate file | `/path/to/ca.pem` |
| `PGSSL_CERT` | Path to client certificate file | `/path/to/client-cert.pem` |
| `PGSSL_KEY` | Path to client key file | `/path/to/client-key.pem` |

#### Examples

**Using connection string:**
```bash
DATABASE_CONNECTION_STRING=postgres://admin:secret@db.example.com:5432/production
PGQUERY_TIMEOUT=60000
```

**Using individual parameters:**
```bash
PGUSER=admin
PGPASSWORD=secret
PGHOST=db.example.com
PGPORT=5432
PGDATABASE=production
PGQUERY_TIMEOUT=60000
PGLOCK_TIMEOUT=30000
```

**Local development example:**
```bash
PGUSER=developer
PGPASSWORD=localpass
PGHOST=localhost
PGPORT=5432
PGDATABASE=testdb
```

**SSL connection with self-signed certificates (development):**
```bash
PGUSER=developer
PGPASSWORD=devpass
PGHOST=secure.dev.example.com
PGPORT=5432
PGDATABASE=devdb
PGSSL_ENABLED=true
PGSSL_REJECT_UNAUTHORIZED=false
```

**SSL connection with full certificate validation (production):**
```bash
DATABASE_CONNECTION_STRING=postgres://admin:secret@secure.db.example.com:5432/production
PGSSL_ENABLED=true
PGSSL_CA=/path/to/ca-certificate.pem
PGSSL_CERT=/path/to/client-certificate.pem
PGSSL_KEY=/path/to/client-key.pem
```

**SSL with custom CA certificate only:**
```bash
PGUSER=admin
PGPASSWORD=secret
PGHOST=db.example.com
PGPORT=5432
PGDATABASE=production
PGSSL_ENABLED=true
PGSSL_CA=/path/to/custom-ca.pem
```
