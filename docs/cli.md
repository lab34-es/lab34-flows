# CLI reference

```
lab34-flows --file <path-to-yaml> --env <environment> [options]
lab34-flows --server [--context <dir>]
lab34-flows --ai "<prompt>"
lab34-flows --capabilities
```

## Options

| Option | Description |
|---|---|
| `--file <path>` | Path to the YAML flow file, relative to the workspace (or absolute) |
| `--env <name>` | Environment to run with. Must match a `<name>.env` file of every application used by the flow |
| `--context <dir>` | Workspace directory. Defaults to `~/lab34-flows` |
| `--server` | Start the web GUI (API + frontend) on <http://localhost:3001> |
| `--ai "<prompt>"` | Generate a flow from a natural-language prompt and save it as `flow-<random>.yaml` in the current directory |
| `--capabilities` | Print every application and method available in the workspace |
| `--keep-alive` | Do not exit the process when the flow finishes (useful with Playwright's `keepOpen`) |
| `--debug` | Print environment variables and Node.js runtime details before running |
| `--v` | Print the version |
| `--help` | Show help |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Flow completed and every test passed |
| `1` | A step failed, a test failed, or the flow could not start (bad environment, missing file...) |

This makes flows directly usable as CI checks:

```yaml
# GitHub Actions example
- run: npm install -g @lab34/flows
- run: lab34-flows --context ./e2e-workspace --file flows/smoke/health.yaml --env staging
```

## Examples

```bash
# Run a flow against staging
lab34-flows --file flows/orders/create-order.yaml --env staging

# Same, with a workspace kept inside the repository
lab34-flows --context ./e2e-workspace --file flows/orders/create-order.yaml --env staging

# List everything flows can call
lab34-flows --capabilities

# Draft a flow with AI (requires config/ai.json, see docs/ai-flow-generation.md)
lab34-flows --ai "Create an order and verify the invoice is produced"

# Start the GUI for the example workspace
lab34-flows --server --context examples/workspace
```

## Notes

- `--server` uses the frontend build shipped with the package. When running from
  a source checkout without a build, it installs the frontend dependencies and
  builds it once, then starts the server.
- When a flow uses mimicked applications or MQTT clients, the CLI exits
  explicitly at the end (they would otherwise keep the process alive). Use
  `--keep-alive` to opt out.
