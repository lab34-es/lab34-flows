# AI flow generation

Lab34 Flows can draft flows from natural-language prompts using Google Gemini.
The prompt is grounded with the **applications and methods of your workspace**
(their names, descriptions and parameter schemas), so the generated YAML calls
things that actually exist. Good method descriptions directly improve the
results.

## Configuration

Create `<workspace>/config/ai.json`:

```json
{
  "defaultProvider": "gemini",
  "gemini": {
    "apiKey": "YOUR_GEMINI_API_KEY_HERE",
    "model": "gemini-2.0-flash",
    "temperature": 0.7,
    "topP": 0.95,
    "topK": 40
  }
}
```

A template is available at
[`examples/workspace/config/ai.json.example`](../examples/workspace/config/ai.json.example).
Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

| Field | Description |
|---|---|
| `gemini.apiKey` | Your Gemini API key (required) |
| `gemini.model` | Model name (default `gemini-pro`) |
| `gemini.temperature`, `topP`, `topK` | Optional sampling parameters |

> The config file lives in your workspace, next to your env files — keep it out
> of shared repositories, or inject the key in CI.

## From the GUI

On the **Flows** page, press **Generate with AI**:

1. Describe the scenario ("Create an order for a random customer and verify the
   invoice endpoint returns it").
2. Review and edit the generated YAML in the embedded editor.
3. Give it a name and folder, save — and run it like any other flow.

## From the CLI

```bash
lab34-flows --ai "Test the user registration process with valid data"
```

The generated flow is written to `flow-<random>.yaml` in the current directory.
Review it, move it into your workspace's `flows/` folder, and run it.

## Tips for better generations

- Write real descriptions in your application methods — they are the AI's only
  knowledge of your systems.
- Mention concrete data in the prompt ("customer 57 must be rejected") and the
  scenario boundaries ("only the order endpoints").
- Treat the output as a draft: check parameters and tests before trusting it.
