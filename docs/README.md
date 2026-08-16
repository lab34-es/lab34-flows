# Lab34 Flows — Documentation

Lab34 Flows is a CLI + GUI tool to define, run and test end-to-end flows across
HTTP APIs, databases, MQTT and web applications — with YAML files you can share
with your team.

## Start here

| Guide | What you'll learn |
|---|---|
| [Getting started](getting-started.md) | Install the tool, create a workspace, run your first flow |
| [The GUI](gui.md) | Browse flows, edit YAML, run flows with live progress, manage environments |
| [CLI reference](cli.md) | Every flag, exit codes, CI usage |

## Writing flows

| Guide | What you'll learn |
|---|---|
| [Flow files](flows.md) | The YAML format: steps, parameters, slugs, chaining data between steps |
| [Testing](testing.md) | Assert status codes and bodies, `$expr:` JavaScript assertions, retries, latent (MQTT) tests |
| [Replacers](replacers.md) | Generate random / dynamic data with `{{ ... }}` placeholders |
| [Mimicking](mimicking.md) | Impersonate dependencies locally and force failure scenarios |

## Extending the tool

| Guide | What you'll learn |
|---|---|
| [Applications](applications.md) | Teach the tool how to talk to your systems (the core extension point) |
| [Environments](environments.md) | Per-application `.env` files, secrets, PostgreSQL configuration |
| [Playwright](playwright.md) | Drive real browsers from flows (experimental) |
| [AI flow generation](ai-flow-generation.md) | Generate flows from natural-language prompts |

## For contributors

| Guide | What you'll learn |
|---|---|
| [Architecture](architecture.md) | Repo layout, API endpoints, socket events, how a flow executes |

## Ready-made examples

The [`examples/workspace`](../examples) directory is a complete workspace with two
applications and four flows — including one that runs fully offline. Point the tool
at it with `--context examples/workspace` and explore.
