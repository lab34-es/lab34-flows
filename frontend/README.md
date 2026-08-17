# Lab34 Flows — frontend

The web UI of [lab34-flows](../README.md): the flow tree, the notebook view that
runs a flow and shows each step's execution below its code block, the application
pages, and the settings.

It is served by the tool itself (`lab34-flows --server`) from `frontend/dist`, so
in normal use there is nothing to run here.

## Stack

- **React 19** + **React Router 7**
- **Vite 7** as the build tool and dev server
- **Tailwind CSS 4** with [shadcn/ui](https://ui.shadcn.com) components (Radix
  primitives, `lucide-react` icons)
- **Monaco** (`@monaco-editor/react`) for the Source editors
- **react-markdown** + `remark-gfm` for the document view
- **Socket.IO client** for live execution updates
- **Axios** for the REST calls

## Development

From the repository root:

```bash
npm run install:frontend   # install these dependencies
npm run dev:full           # API on :3001 and this dev server on :3000
```

Or separately:

```bash
npm run dev                # API only, port 3001
npm run frontend           # this dev server only, port 3000
```

The dev server proxies `/api` and `/socket.io` to `http://localhost:3001`
(see `vite.config.js`), so there is no API URL to configure: every request is
same-origin in development and in production alike.

### Scripts

| Script | What it does |
|-|-|
| `npm run dev` | Start the Vite dev server on port 3000 |
| `npm run build` | Build into `dist/`, which the API serves |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |

## Structure

```text
src/
├── components/
│   ├── app-sidebar/     # Flow tree, application list, and their dialogs
│   ├── application/     # Application page: docs and the Source file explorer
│   ├── flow/            # Notebook cells, execution output, AI edit, Xray chips
│   ├── settings/        # AI, Xray, UI and Help sections
│   ├── shared/          # Markdown, code blocks, status dots
│   └── ui/              # shadcn/ui primitives
├── context/             # App state, execution state, theme
├── hooks/
├── lib/                 # Flow parsing, Monaco setup, templates, helpers
├── pages/               # Home, Flow, Application, Settings
└── services/            # REST client and socket client
```

The `@` alias points at `src/`.

## Theme

Light, dark and auto (follows the operating system) are handled by
`context/ThemeContext.jsx` and chosen under **Settings › UI**. The choice is kept
in the browser's local storage, not in the context folder, and the default is
dark.
