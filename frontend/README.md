# Lab34 Flows — frontend

React + [Joy UI](https://mui.com/joy-ui/getting-started/) + Vite single-page app
for the Lab34 Flows GUI. It talks to the API on port 3001 (REST + Socket.IO).

```bash
# from the repository root
npm run install:frontend
npm run dev:full          # API (:3001) + this app (:3000, hot reload)

npm run build:frontend    # production build into frontend/dist,
                          # served by `lab34-flows --server`
```

Structure:

- `src/components/` — pages and building blocks (FlowList, FlowViewer,
  ExecutionView, ApplicationsList, ...)
- `src/context/EnvironmentContext.jsx` — globally selected environment
- `src/services/api.js` — REST client (axios)
- `src/services/socket.js` — Socket.IO client for live execution updates

User-facing documentation lives in [`../docs/gui.md`](../docs/gui.md).
